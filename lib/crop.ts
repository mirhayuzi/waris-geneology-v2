/**
 * The square of the photo (in photo pixels) that is inside the cropper's circle.
 * The photo is drawn to cover a `view`-sized square at zoom 1, then zoomed by `zoom`
 * and moved by (dx, dy) on screen.
 */
export function cropRect(photo: { width: number; height: number }, view: number, zoom: number, dx: number, dy: number): { x: number; y: number; size: number } {
  const scale = (view / Math.min(photo.width, photo.height)) * zoom; // screen points per photo pixel
  const size = Math.min(view / scale, photo.width, photo.height);
  const cx = photo.width / 2 - dx / scale;
  const cy = photo.height / 2 - dy / scale;
  return {
    x: Math.min(Math.max(0, cx - size / 2), photo.width - size),
    y: Math.min(Math.max(0, cy - size / 2), photo.height - size),
    size,
  };
}
