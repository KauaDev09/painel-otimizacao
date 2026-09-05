import React from 'react';

/**
 * Núcleo interativo: só anima enquanto o mouse está em cima.
 * Sem loop global — não compete com o resto do painel.
 */
export function OrionHoverCore({
  onActivate,
}: {
  onActivate?: () => void;
}) {
  const rootRef = React.useRef<HTMLButtonElement | null>(null);
  const rafRef = React.useRef(0);
  const liveRef = React.useRef(false);
  const target = React.useRef({ x: 0.5, y: 0.5 });
  const current = React.useRef({ x: 0.5, y: 0.5 });

  const apply = React.useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const c = current.current;
    const t = target.current;
    c.x += (t.x - c.x) * 0.14;
    c.y += (t.y - c.y) * 0.14;
    const dx = c.x - 0.5;
    const dy = c.y - 0.5;
    const dist = Math.min(1, Math.hypot(dx * 1.4, dy * 1.4));
    el.style.setProperty('--hx', `${(c.x * 100).toFixed(2)}%`);
    el.style.setProperty('--hy', `${(c.y * 100).toFixed(2)}%`);
    el.style.setProperty('--tilt-x', `${(-dy * 16).toFixed(2)}deg`);
    el.style.setProperty('--tilt-y', `${(dx * 16).toFixed(2)}deg`);
    el.style.setProperty('--glow', (0.55 + (1 - dist) * 0.55).toFixed(3));
    el.style.setProperty('--spin', (0.7 + dist * 1.4).toFixed(3));
    const settled = Math.abs(t.x - c.x) < 0.002 && Math.abs(t.y - c.y) < 0.002;
    if (liveRef.current || !settled) {
      rafRef.current = requestAnimationFrame(apply);
    } else {
      rafRef.current = 0;
    }
  }, []);

  const start = () => {
    liveRef.current = true;
    if (!rafRef.current) rafRef.current = requestAnimationFrame(apply);
  };

  const onMove = (ev: React.PointerEvent<HTMLButtonElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    target.current = {
      x: (ev.clientX - r.left) / r.width,
      y: (ev.clientY - r.top) / r.height,
    };
    start();
  };

  const onLeave = () => {
    liveRef.current = false;
    target.current = { x: 0.5, y: 0.5 };
    if (!rafRef.current) rafRef.current = requestAnimationFrame(apply);
  };

  React.useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <button
      ref={rootRef}
      type="button"
      onPointerMove={onMove}
      onPointerEnter={onMove}
      onPointerLeave={onLeave}
      onClick={onActivate}
      className="orion-hover-core"
      aria-label="Núcleo Orion — passe o mouse"
    >
      <span className="orion-hover-core-spot" />
      <span className="orion-hover-core-stage">
        <span className="orion-hover-core-ring" data-r="outer" />
        <span className="orion-hover-core-ring" data-r="inner" />
        <span className="orion-hover-core-dot" data-o="1" />
        <span className="orion-hover-core-dot" data-o="2" />
        <span className="orion-hover-core-dot" data-o="3" />
        <span className="orion-hover-core-sun" />
      </span>
      <span className="orion-hover-core-copy">
        <span className="orion-hover-core-kicker">Núcleo Orion</span>
        <span className="orion-hover-core-title">Passe o mouse</span>
      </span>
    </button>
  );
}
