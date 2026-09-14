type BrandMarkProps = {
  className?: string;
  /** `mark` = ícone S4 · `wordmark` = ícone + SevenOptimizer · `full` = logo horizontal */
  variant?: 'mark' | 'wordmark' | 'full';
  compact?: boolean;
};

/** Marca SevenOptimizer — assets oficiais da pasta icons/. */
export default function BrandMark({
  className = '',
  variant = 'wordmark',
  compact = false,
}: BrandMarkProps) {
  if (variant === 'full') {
    return (
      <span className={`brand brand-full ${compact ? 'brand-compact' : ''} ${className}`.trim()}>
        <img
          className="brand-logo-full"
          src="/assets/s4-logo-horizontal-dark.png"
          alt="SevenOptimizer"
        />
      </span>
    );
  }

  return (
    <span className={`brand ${compact ? 'brand-compact' : ''} ${className}`.trim()}>
      <span className="brand-mark" aria-hidden="true">
        <img src="/assets/s4-icon.png" alt="" width={32} height={32} />
      </span>
      {variant === 'wordmark' && (
        <span className="brand-word">
          SEVEN<span className="accent">OPTIMIZER</span>
        </span>
      )}
    </span>
  );
}
