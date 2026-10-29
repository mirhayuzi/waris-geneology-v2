import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
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

/** Lets the user pick an image file. Returns its URI and type, or null if cancelled. */
export async function pickImage(): Promise<{ uri: string; mime?: string | null } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: "image/*", copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  return { uri: res.assets[0].uri, mime: res.assets[0].mimeType };
}

/** Lets the user pick one or more files and returns their text ([] if cancelled). */
export async function pickTextFiles(): Promise<{ name: string; text: string }[]> {
  const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: true });
  if (res.canceled || !res.assets?.length) return [];
  const out: { name: string; text: string }[] = [];
  for (const asset of res.assets) {
    const text = Platform.OS === "web" ? await (await fetch(asset.uri)).text() : await FileSystem.readAsStringAsync(asset.uri);
    out.push({ name: asset.name, text });
  }
  return out;
}

/**
 * Saves a text file where the user chooses. Android: system folder picker
 * (Downloads, Drive, etc.). iOS: share sheet ("Save to Files").
 * Returns false if the user cancelled.
 */
export async function saveTextFile(name: string, text: string, mime: string): Promise<boolean> {
  if (Platform.OS === "web") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
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
    await FileSystem.writeAsStringAsync(uri, text);
    return true;
  }
  const path = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(path, text);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(path, { mimeType: mime, dialogTitle: name });
  return true;
}
