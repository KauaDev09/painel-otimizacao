import { useEffect, useRef } from 'react';

/**
 * OrionReactiveCore — visual.md §3–§9
 * Núcleo energético que reage ao cursor (parallax, inclinação, glow) com inércia
 * via lerp + requestAnimationFrame único por instância. Apenas `transform` e
 * `opacity` são animados. `pointer-events: none` em tudo.
 */
type OrionReactiveCoreProps = {
  className?: string;
  compact?: boolean;
};

/* Composição assimétrica: núcleo fora do centro geométrico (§4). */
const CORE_X = 0.58;
const CORE_Y = 0.45;
const LERP = 0.08;

export function OrionReactiveCore({ className = '', compact = false }: OrionReactiveCoreProps) {
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const target = useRef({ x: CORE_X, y: CORE_Y });
  const current = useRef({ x: CORE_X, y: CORE_Y });
  const size = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;

    /* Reduced motion: nada anima (§7). */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const styles = el.style;
    let raf = 0;

    const measure = () => {
      const r = el.getBoundingClientRect();
      size.current.w = r.width;
      size.current.h = r.height;
    };
    measure();

    const onPointerMoveRaw = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width;
      const y = (ev.clientY - rect.top) / rect.height;
      target.current = { x, y };
    };

    const frame = () => {
      const s = current.current;
      s.x += (target.current.x - s.x) * LERP;
      s.y += (target.current.y - s.y) * LERP;

      const dx = s.x - CORE_X;
      const dy = s.y - CORE_Y;
      const dist = Math.min(1, Math.hypot(dx * 1.2, dy));
      const glow = 0.85 + (1 - dist) * 0.3; /* 0.85 – 1.15 */

      /* Glow posicionado via px para só transformar (nunca top/left em loop). */
      styles.setProperty('--pointer-xpx', `${(s.x * size.current.w).toFixed(1)}px`);
      styles.setProperty('--pointer-ypx', `${(s.y * size.current.h).toFixed(1)}px`);
      styles.setProperty('--core-shift-x', `${(-dx * 12).toFixed(2)}px`);
      styles.setProperty('--core-shift-y', `${(-dy * 12).toFixed(2)}px`);
      styles.setProperty('--core-rotate-x', `${(dy * 2.5).toFixed(2)}deg`);
      styles.setProperty('--core-rotate-y', `${(-dx * 2.5).toFixed(2)}deg`);
      styles.setProperty('--core-glow', glow.toFixed(3));
      styles.setProperty('--ring-speed', (1.1 - dist * 0.25).toFixed(3));

      raf = requestAnimationFrame(frame);
    };

    el.addEventListener('pointermove', onPointerMoveRaw);
    el.addEventListener('pointerdown', onPointerMoveRaw);
    window.addEventListener('resize', measure);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onPointerMoveRaw);
      el.removeEventListener('pointerdown', onPointerMoveRaw);
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <div
      ref={fieldRef}
      aria-hidden="true"
      className={`orion-reactive-field${compact ? ' orion-compact' : ''} ${className}`}
    >
      {!compact && <div className="orion-grain" />}
      {!compact && <div className="orion-grid" />}
      <div className="orion-pointer-light" />
      <div className="orion-core">
        <div className="orion-core-ring-outer" />
        <div className="orion-core-ring-inner" />
        <div className="orion-core-orbital" data-o="1">
          <i />
        </div>
        <div className="orion-core-orbital" data-o="2">
          <i />
        </div>
        <div className="orion-core-orbital" data-o="3">
          <i />
        </div>
        <div className="orion-core-center">
          <div className="orion-core-glow" />
        </div>
      </div>
    </div>
  );
}