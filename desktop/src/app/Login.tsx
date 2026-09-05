import React from 'react';
import { KeyRound } from 'lucide-react';
import { useApi } from '@/api';
import { OrionReactiveCore } from '@/components/orion-reactive-core';
import logoUrl from '../ui/assets/logo.jpeg';

const STORE_URL = 'https://orion-store-dun.vercel.app';

export function Login() {
  const api = useApi();
  const [key, setKey] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ text: string; kind: 'err' | 'ok' | 'info' } | null>(null);
  const [showKey, setShowKey] = React.useState(false);

  const activate = React.useCallback(async () => {
    const k = key.trim();
    if (!k) {
      setMsg({ text: 'Informe a Key recebida na compra.', kind: 'err' });
      return;
    }
    setBusy(true);
    setMsg({ text: 'Validando licença…', kind: 'info' });
    try {
      await api.licenseActivate(k);
      const state = await api.licenseGetState();
      setMsg({ text: 'Licença validada', kind: 'ok' });
      setBusy(false);
      if (state.active) location.reload();
    } catch (err) {
      const map: Record<string, string> = {
        LICENSE_NOT_FOUND: 'Key inválida — verifique se digitou corretamente.',
        LICENSE_EXPIRED: 'Licença expirada — renove na Orion Store.',
        LICENSE_BLOCKED: 'Licença bloqueada — contate o suporte.',
        VERSION_NOT_AUTHORIZED: 'Esta versão não está autorizada pela sua licença.',
        DEVICE_LIMIT: 'Limite de dispositivos atingido para esta key.',
        EMPTY_KEY: 'Informe uma key de licença.',
      };
      setMsg({
        text: map[(err as { code?: string })?.code ?? ''] || `Falha na validação: ${(err as Error)?.message ?? err}`,
        kind: 'err',
      });
      setBusy(false);
    }
  }, [api, key]);

  const buy = () => api.openExternal?.(STORE_URL);

  const msgClass =
    msg?.kind === 'err'
      ? 'text-red-400'
      : msg?.kind === 'ok'
        ? 'text-green-400'
        : 'text-[var(--orion-text-secondary)]';

  const hasError = msg?.kind === 'err';

  return (
    <div className="drag-region relative flex h-full items-center justify-center bg-[var(--orion-bg)]">
      <OrionReactiveCore className="absolute inset-0 z-0" />
      <div className="no-drag login-in relative z-10 w-[min(400px,92vw)] rounded-lg bg-[rgba(14,12,20,0.6)] p-10 text-center shadow-[0_0_0_1px_rgba(145,99,212,0.08),0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <img src={logoUrl} alt="Orion" className="h-10 w-10 rounded-lg object-cover" />
          <div className="text-left leading-none">
            <div className="text-[1.35rem] font-bold tracking-[0.16em] text-foreground">ORION</div>
            <div className="mt-1 text-[0.68rem] font-semibold tracking-[0.34em] text-muted-foreground">
              OPTIMIZER
            </div>
          </div>
        </div>

        <h1 className="mb-1.5 text-[1.05rem] font-semibold text-foreground">Entrar no painel</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Digite a key da sua compra para liberar o acesso.
        </p>

        <div
          className={[
            'mb-3.5 flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-black/40 px-3 py-2.5 transition-all duration-200 ease-out',
            hasError ? 'border-red-500/60' : 'focus-within:border-[var(--orion-hover-border)] focus-within:shadow-[0_0_0_1px_var(--orion-hover-border),0_4px_16px_var(--orion-hover-glow)]',
          ].join(' ')}
        >
          <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && activate()}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            maxLength={29}
            spellCheck={false}
            autoComplete="off"
            className="w-full border-0 bg-transparent text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            tabIndex={0}
            onClick={() => setShowKey((s) => !s)}
            className="shrink-0 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-[var(--orion-hover-fg)]"
          >
            {showKey ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={activate}
          className="orion-glow mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--orion-icon-active)] py-2.5 text-sm font-semibold text-black transition-colors duration-200 ease-out hover:bg-[var(--orion-hover-fg)] disabled:opacity-60"
        >
          {busy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              <span>Validando…</span>
            </>
          ) : (
            'ATIVAR KEY'
          )}
        </button>

        {msg && <div className={`mb-3 text-sm ${msgClass}`}>{msg.text}</div>}

        <div className="mb-4 text-sm text-muted-foreground">
          Não possui uma Key?{' '}
          <button type="button" onClick={buy} className="font-medium text-primary underline-offset-4 hover:underline">
            Adquira sua licença
          </button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground/70">
          A key é validada de forma segura no servidor. Nenhum dado sensível é armazenado no aplicativo.
        </p>
      </div>
    </div>
  );
}