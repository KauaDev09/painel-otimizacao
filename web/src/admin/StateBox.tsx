import { MASCOT, type MascotType } from './utils';

type StateBoxProps = {
  type: MascotType | string;
  title?: string;
  desc?: string;
  children?: React.ReactNode;
};

export default function StateBox({ type, title = '', desc = '', children }: StateBoxProps) {
  const img = MASCOT[type as MascotType] || MASCOT.empty;
  return (
    <div className={`state-box ${type}`}>
      <img src={img} alt="Orion" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      {title ? <div className="state-title">{title}</div> : null}
      {desc ? <div className="state-desc">{desc}</div> : null}
      {children ? <div className="state-actions">{children}</div> : null}
    </div>
  );
}
