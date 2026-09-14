/** Read any image file as a data URL without compression. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('Could not read the selected image.'));
    };
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

/** Resize and compress an image file for logo upload. Falls back gracefully for large files. */
export async function compressLogoFile(
  file: File,
  maxBytes = 1_500_000,
): Promise<{ dataUrl: string; mime: string }> {
  try {
    const img = await loadImageFromFile(file);
    const maxDim = 800;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > maxDim || h > maxDim) {
      if (w >= h) {
        h = Math.round((h / w) * maxDim);
        w = maxDim;
      } else {
        w = Math.round((w / h) * maxDim);
        h = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { dataUrl: await readFileAsDataUrl(file), mime: file.type || 'image/jpeg' };
    ctx.drawImage(img, 0, 0, w, h);

    let lastUrl = canvas.toDataURL('image/jpeg', 0.85);
    for (const quality of [0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4, 0.3]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      lastUrl = dataUrl;
      const rawLen = atob(dataUrl.split(',')[1] ?? '').length;
      if (rawLen <= maxBytes) {
        return { dataUrl, mime: 'image/jpeg' };
      }
    }
    return { dataUrl: lastUrl, mime: 'image/jpeg' };
  } catch {
    return { dataUrl: await readFileAsDataUrl(file), mime: file.type || 'image/jpeg' };
  }
}

/** Compress product photos for catalog / POS (keep small for JSON metadata). */
export async function compressProductImage(
  file: File,
  maxBytes = 100_000,
): Promise<{ dataUrl: string; mime: string }> {
  try {
    const img = await loadImageFromFile(file);
    const maxDim = 320;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > maxDim || h > maxDim) {
      if (w >= h) {
        h = Math.round((h / w) * maxDim);
        w = maxDim;
      } else {
        w = Math.round((w / h) * maxDim);
        h = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { dataUrl: await readFileAsDataUrl(file), mime: file.type || 'image/jpeg' };
    ctx.drawImage(img, 0, 0, w, h);

    let lastUrl = canvas.toDataURL('image/jpeg', 0.82);
    for (const quality of [0.88, 0.78, 0.68, 0.55, 0.42, 0.32]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      lastUrl = dataUrl;
      const rawLen = atob(dataUrl.split(',')[1] ?? '').length;
      if (rawLen <= maxBytes) {
        return { dataUrl, mime: 'image/jpeg' };
      }
    }
    return { dataUrl: lastUrl, mime: 'image/jpeg' };
  } catch {
    return { dataUrl: await readFileAsDataUrl(file), mime: file.type || 'image/jpeg' };
  }
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the selected image.'));
    };
    img.src = url;
  });
}
