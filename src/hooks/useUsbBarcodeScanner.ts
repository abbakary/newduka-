import { useCallback, useEffect, useRef } from 'react';

/**
 * USB handheld scanners act as keyboard wedges (rapid chars + Enter).
 * Listens globally while `enabled` and calls onScan with the full string.
 */
export function useUsbBarcodeScanner(
  enabled: boolean,
  onScan: (code: string) => void,
  options?: { minLength?: number; maxGapMs?: number },
) {
  const bufferRef = useRef('');
  const lastKeyAtRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const minLength = options?.minLength ?? 3;
  const maxGapMs = options?.maxGapMs ?? 80;

  const flush = useCallback(() => {
    const code = bufferRef.current.trim();
    bufferRef.current = '';
    if (code.length >= minLength) {
      onScanRef.current(code);
    }
  }, [minLength]);

  useEffect(() => {
    if (!enabled) {
      bufferRef.current = '';
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'textarea') return;

      const now = Date.now();
      if (now - lastKeyAtRef.current > maxGapMs) {
        bufferRef.current = '';
      }
      lastKeyAtRef.current = now;

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minLength) {
          e.preventDefault();
          flush();
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, flush, maxGapMs, minLength]);
}
