type BrandMarkProps = {
  className?: string;
  showWordmark?: boolean;
  compact?: boolean;
};

/** Marca SevenFour — monograma S4 + wordmark. */
export default function BrandMark({
  className = '',
  showWordmark = true,
  compact = false,
}: BrandMarkProps) {
  return (
    <span className={`brand ${compact ? 'brand-compact' : ''} ${className}`.trim()}>
      <span className="brand-mark" aria-hidden="true">
        <img src="/assets/s4-logo.png" alt="" width={32} height={32} />
      </span>
      {showWordmark && (
        <span className="brand-word">
          SEVEN<span className="accent">FOUR</span>
        </span>
      )}
    </span>
  );
}
