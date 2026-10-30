import { type SkImage, Skia } from "@shopify/react-native-skia";
import { photoThumbnail } from "./files";

/**
 * Small decoded photos for the game-style tree. Each is shrunk to 112 px first,
 * so even hundreds of faces on screen use little memory (a full photo would be ~2.5 MB each).
 */
const SIZE = 112;
const MAX = 400;
const cache = new Map<string, SkImage | null>();
const waiting: string[] = [];
const pending = new Set<string>();
const listeners = new Set<() => void>();
let running = 0;
let notifyTimer: ReturnType<typeof setTimeout> | undefined;

/** The decoded photo, or undefined while it loads (null = could not be read). */
export function treePhoto(photo: string): SkImage | null | undefined {
  if (cache.has(photo)) {
    // keep recently used photos at the end, so the oldest are dropped first
    const img = cache.get(photo)!;
    cache.delete(photo);
    cache.set(photo, img);
    return img;
  }
  if (!pending.has(photo)) {
    pending.add(photo);
    waiting.push(photo);
    pump();
  }
  return undefined;
}

/** Called (batched) whenever more photos are ready to draw. */
export function onTreePhotos(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function pump() {
  while (running < 3 && waiting.length) {
    // newest requests first: those are the ones on screen now
    const photo = waiting.pop()!;
    running++;
    load(photo).finally(() => {
      running--;
      pending.delete(photo);
      pump();
    });
  }
}

async function load(photo: string) {
  let img: SkImage | null = null;
  try {
    const small = await photoThumbnail(photo, SIZE);
    if (small) img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(small.base64));
  } catch {
    img = null;
  }
  cache.set(photo, img);
  while (cache.size > MAX) cache.delete(cache.keys().next().value!);
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => listeners.forEach((fn) => fn()), 60);
}

/** A photo was changed or removed: decode it again next time. */
export function forgetTreePhoto(photo?: string) {
  if (photo) cache.delete(photo);
}
