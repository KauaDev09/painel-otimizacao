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
        : 'text-muted-foreground';

  return (
    <div className="drag-region relative flex h-full items-center justify-center bg-background">
      <OrionReactiveCore className="absolute inset-0 z-0" />
      <div className="no-drag login-in relative z-10 w-[min(400px,92vw)] rounded-2xl border border-border bg-card p-10 text-center shadow-2xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <img src={logoUrl} alt="Orion" className="h-10 w-10 rounded-lg object-cover" />
          <div className="text-left leading-none">
            <div className="text-[1.35rem] font-bold tracking-[0.16em] text-foreground">ORION</div>
            <div className="mt-1 text-[0.68rem] font-semibold tracking-[0.34em] text-muted-foreground">
              OPTIMIZER
            </div>
          </div>
        </div>

        <h1 className="mb-1.5 text-[1.05rem] font-semibold text-foreground">Acesso ao Orion Optimizer</h1>
        <p className="mb-6 text-sm text-muted-foreground">Insira sua Key para continuar.</p>

        <div className="mb-3.5 flex items-center gap-2 rounded-lg border border-border bg-black/40 px-3 py-2.5">
          <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && activate()}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            maxLength={29}
            spellCheck={false}
            autoComplete="off"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={activate}
          className="mb-3 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'VALIDANDO…' : 'ATIVAR KEY'}
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