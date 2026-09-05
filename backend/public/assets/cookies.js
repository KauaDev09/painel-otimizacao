/*!
 * Orion Optimizer — aviso de cookies
 * Copyright (c) 2026 Orion
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Licença: MIT (open source). Scripts de interface, fontes externas e o
 * ping de log de acesso só rodam depois do aceite.
 */
'use strict';

(function () {
  var KEY = 'orion_cookie_consent';
  var FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesk:opsz,wght@12..96,500;700;800&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap';

  function read() {
    try { return localStorage.getItem(KEY) === 'accepted'; } catch (_) { return false; }
  }

  window.OrionConsent = {
    accepted: read(),
    accept: accept,
    license: 'MIT'
  };

  function injectFonts() {
    if (document.getElementById('orion-fonts')) return;
    var pre1 = document.createElement('link');
    pre1.rel = 'preconnect';
    pre1.href = 'https://fonts.googleapis.com';
    var pre2 = document.createElement('link');
    pre2.rel = 'preconnect';
    pre2.href = 'https://fonts.gstatic.com';
    pre2.crossOrigin = 'anonymous';
    var link = document.createElement('link');
    link.id = 'orion-fonts';
    link.rel = 'stylesheet';
    link.href = FONTS;
    document.head.appendChild(pre1);
    document.head.appendChild(pre2);
    document.head.appendChild(link);
  }

  function unlockScripts() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('script[type="text/plain"][data-consent]'));
    var i = 0;
    function next() {
      if (i >= nodes.length) {
        pingAccess();
        return;
      }
      var old = nodes[i++];
      var s = document.createElement('script');
      if (old.src) {
        s.src = old.src;
        s.onload = next;
        s.onerror = next;
      } else {
        s.textContent = old.textContent;
      }
      old.parentNode.replaceChild(s, old);
      if (!old.src) next();
    }
    next();
  }

  function pingAccess() {
    try {
      fetch('/api/v1/public/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'page',
          path: location.pathname + location.search
        })
      }).catch(function () {});
    } catch (_) { /* ignore */ }
  }

  function accept() {
    try { localStorage.setItem(KEY, 'accepted'); } catch (_) {}
    window.OrionConsent.accepted = true;
    var bar = document.getElementById('orion-cookie');
    if (bar) bar.remove();
    document.documentElement.classList.remove('cookie-wait');
    injectFonts();
    unlockScripts();
  }

  function banner() {
    if (document.getElementById('orion-cookie')) return;
    document.documentElement.classList.add('cookie-wait');
    var el = document.createElement('div');
    el.id = 'orion-cookie';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Aceitar cookies');
    el.innerHTML =
      '<div class="ck-box">' +
        '<img class="ck-logo" src="/assets/icon.jpeg" alt="Orion">' +
        '<div class="ck-copy">' +
          '<strong>Aceitar cookies</strong>' +
          '<p>Usamos cookies e armazenamento local para sessão da conta, segurança (log de acesso) e preferência deste aviso. Sem o aceite, scripts da interface, fontes externas e o registro de visita ficam bloqueados.</p>' +
          '<p class="ck-mit">Este aviso é <em>open source</em>, licença <strong>MIT</strong>. <a href="/privacidade">Política de privacidade</a> · <a href="/termos">Termos de uso</a></p>' +
        '</div>' +
        '<button type="button" class="btn btn-primary" id="orion-cookie-ok">Aceitar cookies</button>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('orion-cookie-ok').addEventListener('click', accept);
  }

  function boot() {
    if (read()) {
      injectFonts();
      unlockScripts();
      return;
    }
    banner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
