import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Package, X } from 'lucide-react';
import { compressProductImage, readFileAsDataUrl } from '@/lib/imageCompress';

interface ProductImageThumbProps {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'card';
  className?: string;
}

const SIZE_PX = { sm: 40, md: 52, lg: 88, card: 112 } as const;

/** Displays product photo or a neutral package placeholder. */
export const ProductImageThumb: React.FC<ProductImageThumbProps> = ({
  src,
  name = 'Product',
  size = 'md',
  className = '',
}) => {
  const px = SIZE_PX[size];
  const [failed, setFailed] = useState(false);
  const isCard = size === 'card';

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        width={isCard ? undefined : px}
        height={isCard ? undefined : px}
        className={
          isCard
            ? `w-full h-28 object-cover bg-[#F8F8F8] ${className}`
            : `rounded-lg object-cover border-2 border-[#E1DFDD] bg-[#F8F8F8] shrink-0 shadow-sm ${className}`
        }
        style={isCard ? undefined : { width: px, height: px }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className={
        isCard
          ? `w-full h-28 flex flex-col items-center justify-center gap-1 text-[#A19F9D] bg-[#F3F2F1] ${className}`
          : `rounded-lg border-2 border-dashed border-[#C8C6C4] bg-[#F3F2F1] text-[#8A8886] flex flex-col items-center justify-center shrink-0 ${className}`
      }
      style={isCard ? undefined : { width: px, height: px }}
      title={name}
    >
      <Package className={size === 'sm' ? 'w-4 h-4' : size === 'lg' || size === 'card' ? 'w-7 h-7' : 'w-5 h-5'} />
    </div>
  );
};

interface ProductImageUploaderProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  isSw?: boolean;
  compact?: boolean;
}

/** File picker + preview for product image upload. */
export const ProductImageUploader: React.FC<ProductImageUploaderProps> = ({
  value,
  onChange,
  isSw = false,
  compact = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Local blob preview so the UI updates even before parent state / compression finishes. */
  const [localPreview, setLocalPreview] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (value) setLocalPreview(undefined);
  }, [value]);

  useEffect(() => {
    return () => {
      if (localPreview?.startsWith('blob:')) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(isSw ? 'Chagua faili ya picha.' : 'Please choose an image file.');
      return;
    }
    setBusy(true);
    setError(null);

    // Instant preview (object URL) — must work even if compression fails
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return objectUrl;
    });

    try {
      let dataUrl: string;
      try {
        ({ dataUrl } = await compressProductImage(file));
      } catch {
        dataUrl = await readFileAsDataUrl(file);
      }
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        throw new Error('Invalid image data');
      }
      onChange(dataUrl);
      // Keep showing object URL until parent `value` catches up, then clear via effect
    } catch {
      setLocalPreview(prev => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return undefined;
      });
      setError(isSw ? 'Imeshindikana kusoma picha.' : 'Could not read image.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const displaySrc = value || localPreview;

  return (
    <div className={`flex ${compact ? 'items-center gap-2' : 'flex-col gap-2'}`}>
      <ProductImageThumb src={displaySrc} size={compact ? 'md' : 'lg'} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E1DFDD] bg-white text-xs font-semibold text-[#323130] hover:bg-[#F3F2F1] cursor-pointer disabled:opacity-50"
        >
          <ImagePlus className="w-3.5 h-3.5 text-[#6264A7]" />
          {busy
            ? (isSw ? 'Inapakia…' : 'Uploading…')
            : displaySrc
              ? (isSw ? 'Badilisha picha' : 'Change photo')
              : (isSw ? 'Pakia picha' : 'Upload photo')}
        </button>
        {displaySrc && (
          <button
            type="button"
            onClick={() => {
              setLocalPreview(prev => {
                if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
                return undefined;
              });
              onChange(undefined);
            }}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            {isSw ? 'Ondoa' : 'Remove'}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => void handleFile(e.target.files?.[0] ?? undefined)}
      />
      {error && <p className="text-[10px] text-rose-600">{error}</p>}
      {!compact && (
        <p className="text-[10px] text-[#605E5C]">
          {isSw
            ? 'PNG, JPG au WEBP — inaonekana kwenye stoo, POS, na fomu za kuunda.'
            : 'PNG, JPG or WEBP — shown in inventory, POS, and create forms.'}
        </p>
      )}
    </div>
  );
};
