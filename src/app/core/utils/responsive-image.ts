const CLOUDINARY_UPLOAD_MARKER = '/image/upload/';

export function optimizedImageUrl(source: string, width: number): string {
  const value = String(source ?? '').trim();
  if (!value || !Number.isFinite(width) || width <= 0) return value;

  try {
    const url = new URL(value);
    if (url.hostname !== 'res.cloudinary.com') return value;
    const markerIndex = url.pathname.indexOf(CLOUDINARY_UPLOAD_MARKER);
    if (markerIndex < 0) return value;

    const assetPath = url.pathname.slice(markerIndex + CLOUDINARY_UPLOAD_MARKER.length);
    if (!/^v\d+\//.test(assetPath)) return value;

    const transformation = `f_auto,q_auto,c_limit,w_${Math.round(width)}/`;
    url.pathname = `${url.pathname.slice(0, markerIndex + CLOUDINARY_UPLOAD_MARKER.length)}${transformation}${assetPath}`;
    return url.href;
  } catch {
    return value;
  }
}

export function responsiveImageSrcset(source: string, widths: readonly number[]): string | null {
  const value = String(source ?? '').trim();
  if (!value) return null;

  const candidates = Array.from(new Set(widths.map((width) => Math.round(width)).filter((width) => width > 0)));
  const transformed = candidates.map((width) => ({ width, url: optimizedImageUrl(value, width) }));
  if (!transformed.length || transformed.every((candidate) => candidate.url === value)) return null;
  return transformed.map((candidate) => `${candidate.url} ${candidate.width}w`).join(', ');
}
