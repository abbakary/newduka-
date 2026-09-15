import { useEffect, type ReactNode, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface ModalPortalProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  /** Overlay z-index class. Default above page chrome and below toasts. */
  zClassName?: string;
  /** Close when clicking the dimmed backdrop. Default true. */
  closeOnBackdrop?: boolean;
}

/**
 * Renders dialogs on document.body so they are not trapped by
 * overflow/backdrop-filter on the scrollable main pane.
 *
 * Always top-aligns (never vertical-center) so tall forms are not clipped
 * at the top of the viewport — users can scroll the overlay instead.
 */
export function ModalPortal({
  open,
  onClose,
  children,
  className,
  zClassName = 'z-[200]',
  closeOnBackdrop = true,
}: ModalPortalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const onBackdrop = (e: MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop) return;
    if (e.target === e.currentTarget) onClose?.();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        'fixed inset-0 overflow-y-auto overscroll-contain bg-black/50',
        zClassName,
        className,
      )}
      onMouseDown={onBackdrop}
    >
      <div className="flex min-h-full items-start justify-center p-3 sm:p-6">
        <div className="w-full max-w-full flex justify-center pointer-events-none py-2">
          <div className="pointer-events-auto w-full max-w-full flex justify-center">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface ToastPortalProps {
  children: ReactNode;
  className?: string;
}

/** Success/error banners above modals (z-300). */
export function ToastPortal({ children, className }: ToastPortalProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className={cn(
        'fixed top-16 right-4 sm:right-6 z-[300] flex flex-col items-end gap-2 pointer-events-none',
        className,
      )}
    >
      <div className="pointer-events-auto">{children}</div>
    </div>,
    document.body,
  );
}
