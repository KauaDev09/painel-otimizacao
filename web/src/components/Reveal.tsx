import { useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';

type RevealProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: keyof HTMLElementTagNameMap;
};

export default function Reveal({ children, className = '', as: Tag = 'div', ...rest }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  const combined = `reveal${className ? ` ${className}` : ''}`;

  return (
    // @ts-expect-error dynamic tag ref
    <Tag ref={ref} className={combined} {...rest}>
      {children}
    </Tag>
  );
}
