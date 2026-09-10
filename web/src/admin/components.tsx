import { daysLeft, esc } from './utils';

export function KeyMono({ value }: { value: string }) {
  return <span className="key-mono">{value}</span>;
}

export function Badge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`badge badge-${status}`}>{label ?? status}</span>
  );
}

export function ExpBadge({ exp }: { exp: string | null | undefined }) {
  if (!exp) return <span className="badge badge-ativa">Nunca</span>;
  const d = daysLeft(exp);
  const cls = d !== null && d <= 7 ? 'st-expirada' : '';
  const days = d !== null ? Math.max(0, d) : 0;
  return (
    <span className={`badge ${cls}`}>
      {new Date(exp).toLocaleDateString('pt-BR')} ({days} d)
    </span>
  );
}

export function StatusBadge({ st }: { st: string }) {
  const ORDER_STATUS: Record<string, string> = {
    pending: 'badge-pendente',
    paid: 'badge-ativa',
    cancelled: 'badge-inativa',
    failed: 'badge-bloqueada',
  };
  const cls = ORDER_STATUS[st] || 'badge-inativa';
  return <span className={`badge ${cls}`}>{st}</span>;
}

export function TableLoading({ cols, title, desc }: { cols: number; title: string; desc?: string }) {
  return (
    <tr>
      <td colSpan={cols}>
        <StateBoxLazy type="loading" title={title} desc={desc} />
      </td>
    </tr>
  );
}

export function TableEmpty({ cols, title, desc }: { cols: number; title: string; desc?: string }) {
  return (
    <tr>
      <td colSpan={cols}>
        <StateBoxLazy type="empty" title={title} desc={desc} />
      </td>
    </tr>
  );
}

import StateBox from './StateBox';

function StateBoxLazy(props: React.ComponentProps<typeof StateBox>) {
  return <StateBox {...props} />;
}

export function PageHeading({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="page-heading">
      <h2>{title}</h2>
      <p>{desc}</p>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: '0.8rem',
        letterSpacing: '1.2px',
        color: 'var(--primary-3)',
        textTransform: 'uppercase',
        marginBottom: '14px',
        fontWeight: 600,
      }}
    >
      {children}
    </h2>
  );
}

export function escHtml(s: unknown) {
  return esc(s);
}
