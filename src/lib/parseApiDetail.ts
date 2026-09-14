export function parseApiDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (!item || typeof item !== 'object') return String(item);
        const rec = item as { loc?: unknown[]; msg?: string };
        const field = Array.isArray(rec.loc) ? String(rec.loc[rec.loc.length - 1] ?? '') : '';
        const msg = rec.msg ?? 'Invalid value';
        if (field === 'password') {
          return 'Password must be at least 6 characters';
        }
        return field ? `${field}: ${msg}` : msg;
      })
      .join('; ');
  }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail);
  }
  return 'Request failed';
}
