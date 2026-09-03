'use strict';

// PaymentProvider — camada isolada de integração com o gateway de pagamento.
//
// A arquitetura permite trocar o gateway (ex.: Mercado Pago -> Stripe -> outro)
// sem reescrever o restante do sistema: basta criar um novo adapter que siga a
// mesma interface.
//
// Métodos da interface:
//   createCheckout({ order, customer, plan })  -> { checkoutUrl } | { qrCode, ... }
//   getPayment(paymentId)                      -> { status, amount, rawStatus, externalRef }
//   verifyPayment(paymentId)                   -> bool
//   handleWebhook(body, headers)               -> { eventId, eventType, paymentId, processed }
//
// Status normalizado do gateway (para o domínio):
//   pending | approved | rejected | refunded | in_process

const crypto = require('crypto');
const config = require('../config');

const NORMALIZE = {
  approved: 'approved',
  pending: 'pending',
  in_process: 'pending',
  in_mediation: 'pending',
  rejected: 'rejected',
  cancelled: 'rejected',
  refunded: 'refunded',
  charged_back: 'refunded'
};

function normalize(raw) {
  const key = String(raw || '').toLowerCase();
  return NORMALIZE[key] || 'pending';
}

// ---------------------------------------------------------------
// Adapter: Mercado Pago (Checkout Pro / preference com PIX + cartão)
// ---------------------------------------------------------------
class MercadoPagoProvider {
  constructor(cfg) {
    this.cfg = cfg.mercadopago || {};
    this.authorization = `Bearer ${this.cfg.accessToken || ''}`;
    this.base = 'https://api.mercadopago.com';
    this.ready = !!(this.cfg.accessToken);
    this.availableMethods = ['pix', 'credit_card'];
  }

  isConfigured() {
    return this.ready;
  }

  async _post(pathname, data, extraHeaders) {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: this.authorization
    };
    if (extraHeaders) Object.assign(headers, extraHeaders);
    const res = await fetch(this.base + pathname, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json.message || `Mercado Pago HTTP ${res.status}`);
      err.status = res.status;
      err.detail = json;
      throw err;
    }
    return json;
  }

  async _get(pathname) {
    const res = await fetch(this.base + pathname, {
      headers: { Authorization: this.authorization, 'Accept': 'application/json' }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json.message || `Mercado Pago HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  // Cria o pagamento. Para PIX, gera um QR Code (imagem) + chave copiável
  // diretamente. Para cartão, cria uma preferência com redirecionamento ao gateway.
  async createCheckout({ order, customer, plan, method }) {
    if (!this.ready) {
      const e = new Error('MERCADOPAGO_NOT_CONFIGURED');
      e.code = 'PAYMENT_NOT_CONFIGURED';
      throw e;
    }
    const externalRef = order.order_uuid;
    const amount = Number(order.amount);
    const notificationUrl = (config.appUrl || '') + '/api/v1/public/webhooks/mercadopago';

    if (method === 'pix') {
      const payer = { email: 'comprador@example.com' };
      if (customer && customer.email) {
        const nameParts = String(customer.name || '').trim().split(/\s+/);
        payer.email = customer.email;
        if (nameParts[0]) payer.first_name = nameParts[0];
        if (nameParts.slice(1).join(' ')) payer.last_name = nameParts.slice(1).join(' ');
      }
      const pay = await this._post('/v1/payments', {
        transaction_amount: amount,
        description: `Orion Optimizer — Plano ${plan.name}`,
        payment_method_id: 'pix',
        external_reference: externalRef,
        notification_url: notificationUrl,
        payer
      }, { 'X-Idempotency-Key': crypto.randomUUID() });
      const td = (pay && pay.point_of_interaction && pay.point_of_interaction.transaction_data) || {};
      return {
        qr_code: td.qr_code_base64 ? `data:image/png;base64,${td.qr_code_base64}` : null,
        qr_code_text: td.qr_code || null,
        paymentId: String(pay.id || ''),
        paymentMethod: 'pix',
        checkoutUrl: null,
        status: normalize(pay.status)
      };
    }

    // Cartão de crédito (ou padrão): preferência com redirecionamento.
    const item = {
      id: String(order.id || externalRef),
      title: `Orion Optimizer — Plano ${plan.name}`,
      quantity: 1,
      unit_price: amount,
      currency_id: String(order.currency || 'BRL'),
      description: plan.description || 'Licença Orion Optimizer'
    };
    const body = {
      items: [item],
      external_reference: externalRef,
      notification_url: notificationUrl
    };
    if (customer && customer.email) {
      body.payer = {
        name: customer.name || null,
        email: customer.email,
        identification: customer.identification || {}
      };
    }
    const pref = await this._post('/checkout/preferences', body);
    return {
      checkoutUrl: pref.init_point || pref.sandbox_init_point || null,
      preferenceId: pref.id,
      paymentMethods: { pix: true, credit_card: true }
    };
  }

  async getPayment(paymentId) {
    const p = await this._get(`/v1/payments/${encodeURIComponent(paymentId)}`);
    return {
      paymentId: String(p.id || ''),
      status: normalize(p.status),
      rawStatus: p.status,
      amount: Number(p.transaction_amount),
      externalRef: p.external_reference || null,
      approvedAt: p.date_approved || null,
      method: p.payment_method_id || null,
      raw: p
    };
  }

  async verifyPayment(paymentId) {
    try {
      const p = await this.getPayment(paymentId);
      return p.status === 'approved';
    } catch (_) {
      return false;
    }
  }

  // Valida e interpreta o webhook recebido do Mercado Pago.
  // Retorna null (rejeitar silenciosamente) se inválido.
  async handleWebhook(body, headers) {
    const type = body && (body.type || body.action);
    const data = body && body.data;
    const paymentId = data && (data.id != null ? String(data.id) : null);
    // Tipos relevantes: payment, payment.update
    if (!paymentId) return null;
    return {
      eventId: String(paymentId),
      eventType: type || 'payment',
      paymentId,
      processed: false
    };
  }
}

// ---------------------------------------------------------------
// Factory — devolve o adapter do provedor configurado
// ---------------------------------------------------------------
function createProvider() {
  const name = String(config.payment.provider || 'mercadopago').toLowerCase().trim();
  if (name === 'mercadopago') return new MercadoPagoProvider(config.payment);
  // Futuros gateways: Stripe, PIX alternativo, etc.
  throw new Error(`PaymentProvider desconhecido: [${name}] len=${name.length}`);
}

module.exports = { createProvider, normalize };
