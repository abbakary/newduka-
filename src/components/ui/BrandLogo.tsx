import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  /** Display height in px; width scales automatically. */
  height?: number;
  alt?: string;
}

/** DukaMkononi brand mark from `/public/brand_logo.png`. */
export function BrandLogo({ className, height = 40, alt = 'DukaMkononi' }: BrandLogoProps) {
  return (
    <img
      src="/brand_logo.png"
      alt={alt}
      className={cn('object-contain object-left', className)}
      style={{ height, width: 'auto', maxWidth: height * 5.5 }}
      draggable={false}
    />
  );
}

interface BrandMarkProps {
  className?: string;
  size?: number;
  alt?: string;
}

/** Square-ish favicon-style mark for tight spaces (uses same asset, cover crop). */
export function BrandMark({ className, size = 40, alt = 'DukaMkononi' }: BrandMarkProps) {
  return (
    <img
      src="/brand_logo.png"
      alt={alt}
      className={cn('object-cover rounded-xl', className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
