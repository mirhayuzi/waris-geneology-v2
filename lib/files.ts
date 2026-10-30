import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

/**
 * Photos live in <app documents>/photos/. The database stores only the file name,
 * so paths survive app updates (iOS changes the full container path).
 */
const photoDir = () => (FileSystem.documentDirectory ? `${FileSystem.documentDirectory}photos/` : null);

const isUri = (v: string) => /^(file|content|data|blob|https?):/.test(v) || v.startsWith("/");

/** Turns a stored photo value into something <Image> can show. */
export function photoUri(photo: string | undefined): string | undefined {
  if (!photo) return undefined;
  if (isUri(photo)) return photo;
  const dir = photoDir();
  return dir ? dir + photo : undefined;
}

async function ensureDir() {
  const dir = photoDir();
  if (!dir) return null;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

function extOf(uri: string, mime?: string | null): string {
  if (mime?.includes("png")) return "png";
  if (mime?.includes("webp")) return "webp";
  const m = /\.(jpe?g|png|webp|heic)(\?|$)/i.exec(uri);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

/** Copies a picked image into the photos folder. Returns the value to store on the person. */
export async function savePhotoFrom(sourceUri: string, personId: string, mime?: string | null): Promise<string> {
  const dir = await ensureDir();
  if (!dir) return sourceUri; // web preview: keep the in-memory URI
  const name = `${personId}-${Date.now().toString(36)}.${extOf(sourceUri, mime)}`;
  if (sourceUri.startsWith("data:")) {
    await FileSystem.writeAsStringAsync(dir + name, sourceUri.split(",")[1] ?? "", { encoding: FileSystem.EncodingType.Base64 });
  } else {
    await FileSystem.copyAsync({ from: sourceUri, to: dir + name });
  }
  return name;
}

export async function deletePhoto(photo: string | undefined): Promise<void> {
  if (!photo || isUri(photo)) return;
  const dir = photoDir();
  if (!dir) return;
  await FileSystem.deleteAsync(dir + photo, { idempotent: true }).catch(() => {});
}

export async function readPhotoBase64(photo: string): Promise<string | undefined> {
  const uri = photoUri(photo);
  if (!uri || uri.startsWith("data:") || Platform.OS === "web") return undefined;
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    return undefined;
  }
}

export async function writePhotoBase64(name: string, base64: string): Promise<boolean> {
  const dir = await ensureDir();
  if (!dir || /[/\\]/.test(name)) return false;
  await FileSystem.writeAsStringAsync(dir + name, base64, { encoding: FileSystem.EncodingType.Base64 });
  return true;
}

/** Files picked for Restore: backup/CSV text, a Waris Excel file, and photos named by ID. */
export interface RestoreFiles {
  texts: string[];
  /** base64 of an .xlsx file */
  excel?: string;
  images: { name: string; base64: string }[];
}

async function readBase64(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const bytes = new Uint8Array(await (await fetch(uri)).arrayBuffer());
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

/** Lets the user pick one or more files for Restore (null if cancelled). */
export async function pickRestoreFiles(): Promise<RestoreFiles | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: true });
  if (res.canceled || !res.assets?.length) return null;
  const out: RestoreFiles = { texts: [], images: [] };
  for (const asset of res.assets) {
    const name = asset.name ?? "";
    const mime = asset.mimeType ?? "";
    if (/\.xls[xm]$/i.test(name) || mime.includes("spreadsheetml")) out.excel = await readBase64(asset.uri);
    else if (/\.(jpe?g|png|webp)$/i.test(name) || mime.startsWith("image/")) out.images.push({ name, base64: await readBase64(asset.uri) });
    else out.texts.push(Platform.OS === "web" ? await (await fetch(asset.uri)).text() : await FileSystem.readAsStringAsync(asset.uri));
  }
  return out;
}

/**
 * A small JPEG of a stored photo (longest side `max` px) for the Excel file.
 * Returns undefined when the photo can't be read.
 */
export async function photoThumbnail(photo: string, max = 320): Promise<{ base64: string; width: number; height: number } | undefined> {
  const uri = photoUri(photo);
  if (!uri || Platform.OS === "web") return undefined;
  try {
    const original = await ImageManipulator.manipulate(uri).renderAsync();
    const scale = Math.min(1, max / Math.max(original.width, original.height));
    const ctx = ImageManipulator.manipulate(uri);
    if (scale < 1) ctx.resize(original.width >= original.height ? { width: Math.round(original.width * scale) } : { height: Math.round(original.height * scale) });
    const img = await ctx.renderAsync();
    const saved = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
    return saved.base64 ? { base64: saved.base64, width: saved.width, height: saved.height } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Saves a text file where the user chooses. Android: system folder picker
 * (Downloads, Drive, etc.). iOS: share sheet ("Save to Files").
 * Returns false if the user cancelled.
 */
export async function saveTextFile(name: string, text: string, mime: string, opts: { base64?: boolean } = {}): Promise<boolean> {
  const encoding = opts.base64 ? { encoding: FileSystem.EncodingType.Base64 } : undefined;
  if (Platform.OS === "web") {
    const a = document.createElement("a");
    a.href = opts.base64 ? `data:${mime};base64,${text}` : URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    a.click();
    return true;
  }
  if (Platform.OS === "android") {
    const SAF = FileSystem.StorageAccessFramework;
    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted) return false;
    // Android adds the extension for known types (.json); unknown types keep the name as given
    const display = mime === "application/json" ? name.replace(/\.json$/, "") : name;
    const uri = await SAF.createFileAsync(perm.directoryUri, display, mime);
    await FileSystem.writeAsStringAsync(uri, text, encoding);
    return true;
  }
  const path = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(path, text, encoding);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(path, { mimeType: mime, dialogTitle: name });
  return true;
}

/** True when a stored photo name already has its file on this phone. */
export async function photoExists(photo: string): Promise<boolean> {
  const uri = photoUri(photo);
  if (!uri || Platform.OS === "web") return false;
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
}

/**
 * Opens the phone's share sheet (WhatsApp, Gmail, Drive ...) with a file.
 * Returns false when sharing isn't available.
 */
export async function shareFile(name: string, content: string, mime: string, opts: { base64?: boolean } = {}): Promise<boolean> {
  if (Platform.OS === "web") return saveTextFile(name, content, mime);
  const path = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(path, content, opts.base64 ? { encoding: FileSystem.EncodingType.Base64 } : undefined);
  if (!(await Sharing.isAvailableAsync())) return false;
  const UTI = mime === "application/pdf" ? "com.adobe.pdf" : mime === XLSX_MIME ? "org.openxmlformats.spreadsheetml.sheet" : "public.json";
  await Sharing.shareAsync(path, { mimeType: mime, dialogTitle: name, UTI });
  return true;
}

/** Shares a file that already exists (e.g. a PDF made by expo-print). */
export async function shareExisting(uri: string, mime: string, title: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: title });
  return true;
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// ---- Profile photos: pick, adjust, crop ---------------------------------------------

/** A photo ready for the cropper: upright, at most 2000 px, with its size in pixels. */
export interface PreparedPhoto {
  uri: string;
  width: number;
  height: number;
}

/** Re-saves a photo upright (camera rotation applied) and not too large, so cropping maths is exact. */
export async function preparePhoto(uri: string): Promise<PreparedPhoto> {
  const first = await ImageManipulator.manipulate(uri).renderAsync();
  const scale = Math.min(1, 2000 / Math.max(first.width, first.height));
  const ctx = ImageManipulator.manipulate(uri);
  if (scale < 1) ctx.resize(first.width >= first.height ? { width: Math.round(first.width * scale) } : { height: Math.round(first.height * scale) });
  const out = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  return { uri: out.uri, width: out.width, height: out.height };
}

/** Gallery or camera. Returns the prepared photo, or null when cancelled or not allowed. */
export async function pickPhoto(from: "gallery" | "camera"): Promise<PreparedPhoto | null> {
  if (from === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, allowsEditing: false, exif: false };
  const res = from === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  return preparePhoto(res.assets[0].uri);
}

export async function rotatePhoto(p: PreparedPhoto): Promise<PreparedPhoto> {
  const out = await (await ImageManipulator.manipulate(p.uri).rotate(90).renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  return { uri: out.uri, width: out.width, height: out.height };
}

/** Cuts a square out of the photo (pixel coordinates) and saves it at most 800 px wide. */
export async function cropSquare(p: PreparedPhoto, r: { x: number; y: number; size: number }): Promise<string> {
  const size = Math.max(1, Math.min(Math.round(r.size), p.width, p.height));
  const originX = Math.min(Math.max(0, Math.round(r.x)), p.width - size);
  const originY = Math.min(Math.max(0, Math.round(r.y)), p.height - size);
  const ctx = ImageManipulator.manipulate(p.uri).crop({ originX, originY, width: size, height: size });
  if (size > 800) ctx.resize({ width: 800 });
  const out = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return out.uri;
}
