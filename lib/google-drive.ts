import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Google Drive Integration
 * Uses @react-native-google-signin/google-signin for native authentication
 * and Google Drive REST API for CSV backup/restore (Fuelio-style).
 */

const GOOGLE_USER_KEY = "@waris_google_user";

// Google Drive API endpoints
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files";

// App folder name on Google Drive
const DRIVE_FOLDER_NAME = "Waris Genealogy";

// Scopes needed for Drive file access
const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
];

export interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

// Lazy-load the native Google Sign-In module
let GoogleSigninModule: any = null;
try {
  GoogleSigninModule = require("@react-native-google-signin/google-signin");
} catch {
  // Not available (web or missing native module)
}

/** For tests only: swap in a fake Google Sign-In module (the lazy require above can't be mocked). */
export function __setGoogleSigninModuleForTests(mod: any): void {
  GoogleSigninModule = mod;
}

/**
 * Configure Google Sign-In (call once at app start).
 * Uses the Web Client ID for getting idToken and server auth code.
 * The Android Client ID is automatically used based on SHA-1 + package name.
 */
export function configureGoogleSignIn(): void {
  if (!GoogleSigninModule || Platform.OS === "web") return;

  const { GoogleSignin } = GoogleSigninModule;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";

  GoogleSignin.configure({
    webClientId: webClientId || undefined,
    scopes: DRIVE_SCOPES,
    offlineAccess: false,
  });
}

/**
 * Sign in with native Google Sign-In.
 * Returns user info on success, null on failure/cancel.
 */
export async function nativeGoogleSignIn(): Promise<GoogleUser | null> {
  if (!GoogleSigninModule || Platform.OS === "web") {
    throw new Error("Google Sign-In is not available on this platform.");
  }

  const { GoogleSignin, isSuccessResponse, statusCodes, isErrorWithCode } = GoogleSigninModule;

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (isSuccessResponse(response)) {
      const userData = response.data;
      const user: GoogleUser = {
        name: userData.user?.name || userData.user?.email || "User",
        email: userData.user?.email || "",
        picture: userData.user?.photo || undefined,
      };
      await storeUser(user);
      return user;
    }

    // User cancelled
    return null;
  } catch (error: any) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.IN_PROGRESS:
          throw new Error("Sign-in already in progress");
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new Error("Google Play Services not available. Please update.");
        default:
          throw new Error(`Google Sign-In error: ${error.code} - ${error.message}`);
      }
    }
    throw error;
  }
}

/**
 * Get a valid access token from the native Google Sign-In.
 * The native module handles token refresh automatically.
 */
export async function getAccessToken(): Promise<string | null> {
  if (!GoogleSigninModule || Platform.OS === "web") return null;

  const { GoogleSignin } = GoogleSigninModule;

  try {
    // After the app restarts, the native module forgets the current user until
    // signInSilently() is called, so restore the previous session first.
    let currentUser = GoogleSignin.getCurrentUser();
    if (!currentUser && GoogleSignin.hasPreviousSignIn()) {
      const response = await GoogleSignin.signInSilently();
      currentUser = response?.type === "success" ? response.data : GoogleSignin.getCurrentUser();
    }
    if (!currentUser) return null;

    // getTokens() returns fresh tokens (auto-refreshed if expired)
    const tokens = await GoogleSignin.getTokens();
    return tokens.accessToken || null;
  } catch (e) {
    console.error("getAccessToken error:", e);

    // Try to clear cached token and retry once
    try {
      const tokens = await GoogleSignin.getTokens();
      if (tokens.accessToken) {
        await GoogleSignin.clearCachedAccessToken(tokens.accessToken);
      }
      const freshTokens = await GoogleSignin.getTokens();
      return freshTokens.accessToken || null;
    } catch {
      return null;
    }
  }
}

/**
 * Store user info in AsyncStorage
 */
async function storeUser(user: GoogleUser): Promise<void> {
  await AsyncStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(user));
}

/**
 * Get stored user info
 */
export async function getStoredUser(): Promise<GoogleUser | null> {
  try {
    // First check native sign-in state
    if (GoogleSigninModule && Platform.OS !== "web") {
      const { GoogleSignin } = GoogleSigninModule;
      const currentUser = GoogleSignin.getCurrentUser();
      if (currentUser) {
        const user: GoogleUser = {
          name: currentUser.user?.name || currentUser.user?.email || "User",
          email: currentUser.user?.email || "",
          picture: currentUser.user?.photo || undefined,
        };
        await storeUser(user);
        return user;
      }
    }

    // Fallback to AsyncStorage
    const value = await AsyncStorage.getItem(GOOGLE_USER_KEY);
    if (!value) return null;
    return JSON.parse(value) as GoogleUser;
  } catch {
    return null;
  }
}

/**
 * Sign out from Google
 */
export async function signOut(): Promise<void> {
  if (GoogleSigninModule && Platform.OS !== "web") {
    const { GoogleSignin } = GoogleSigninModule;
    try {
      await GoogleSignin.signOut();
    } catch {
      // Ignore sign-out errors
    }
  }
  await AsyncStorage.removeItem(GOOGLE_USER_KEY);
}

/**
 * Check if user is signed in
 */
export async function isSignedIn(): Promise<boolean> {
  if (GoogleSigninModule && Platform.OS !== "web") {
    const { GoogleSignin } = GoogleSigninModule;
    return GoogleSignin.hasPreviousSignIn();
  }
  return false;
}

// ==================== GOOGLE DRIVE API ====================

/**
 * Find every Waris Genealogy folder on Drive, oldest first.
 * Earlier versions uploaded files in parallel and could create several folders.
 */
async function findAppFolders(accessToken: string): Promise<string[]> {
  const query = `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=createdTime`;
  const searchResponse = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!searchResponse.ok) return [];
  const searchData = await searchResponse.json();
  return (searchData.files || []).map((f: { id: string }) => f.id);
}

/**
 * Find or create the Waris Genealogy folder on Drive
 */
async function getOrCreateAppFolder(accessToken: string): Promise<string | null> {
  try {
    const existing = await findAppFolders(accessToken);
    if (existing.length > 0) return existing[0];

    // Create folder if not found
    const createResponse = await fetch(DRIVE_FILES_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });

    if (createResponse.ok) {
      const createData = await createResponse.json();
      return createData.id;
    }

    return null;
  } catch (e) {
    console.error("getOrCreateAppFolder error:", e);
    return null;
  }
}

/**
 * Upload a CSV string to Google Drive
 */
export async function uploadCSVToDrive(
  csvContent: string,
  fileName: string,
): Promise<{ success: boolean; message: string; fileId?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, message: "Not signed in to Google. Please sign in first." };
  }

  try {
    const folderId = await getOrCreateAppFolder(accessToken);
    if (!folderId) {
      return { success: false, message: "Failed to create app folder on Google Drive." };
    }

    // Check if file already exists in folder
    const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const searchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id,name)`;
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let existingFileId: string | null = null;
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.files && searchData.files.length > 0) {
        existingFileId = searchData.files[0].id;
      }
    }

    // Build multipart request
    const boundary = "waris_boundary_" + Date.now();
    const metadata = existingFileId
      ? { name: fileName }
      : { name: fileName, mimeType: "text/csv", parents: [folderId] };

    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/csv\r\n\r\n` +
      `${csvContent}\r\n` +
      `--${boundary}--`;

    let uploadUrl: string;
    let method: string;

    if (existingFileId) {
      uploadUrl = `${DRIVE_UPLOAD_ENDPOINT}/${existingFileId}?uploadType=multipart`;
      method = "PATCH";
    } else {
      uploadUrl = `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart`;
      method = "POST";
    }

    const uploadResponse = await fetch(uploadUrl, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (uploadResponse.ok) {
      const uploadData = await uploadResponse.json();
      return {
        success: true,
        message: existingFileId ? `Updated ${fileName} on Google Drive` : `Uploaded ${fileName} to Google Drive`,
        fileId: uploadData.id,
      };
    } else {
      const errorText = await uploadResponse.text();
      console.error("Upload failed:", errorText);
      return { success: false, message: `Upload failed: ${uploadResponse.status}` };
    }
  } catch (e: any) {
    console.error("uploadCSVToDrive error:", e);
    return { success: false, message: `Upload error: ${e?.message || "Unknown"}` };
  }
}

/**
 * List CSV files in the Waris Genealogy folder on Drive
 */
export async function listDriveFiles(): Promise<{ success: boolean; files: DriveFile[]; message?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, files: [], message: "Not signed in to Google." };
  }

  try {
    const folderIds = await findAppFolders(accessToken);
    if (folderIds.length === 0) {
      return { success: true, files: [] };
    }

    const inFolders = folderIds.map((id) => `'${id}' in parents`).join(" or ");
    const query = `(${inFolders}) and trashed=false`;
    const url = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.ok) {
      const data = await response.json();
      const files: DriveFile[] = (data.files || []).filter((f: DriveFile) => f.name.toLowerCase().endsWith(".csv"));
      return { success: true, files };
    } else {
      return { success: false, files: [], message: `Failed to list files: ${response.status}` };
    }
  } catch (e: any) {
    return { success: false, files: [], message: `Error: ${e?.message || "Unknown"}` };
  }
}

/**
 * Download a file from Google Drive by ID
 */
export async function downloadDriveFile(fileId: string): Promise<{ success: boolean; content?: string; message?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, message: "Not signed in to Google." };
  }

  try {
    const url = `${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.ok) {
      const content = await response.text();
      return { success: true, content };
    } else {
      return { success: false, message: `Download failed: ${response.status}` };
    }
  } catch (e: any) {
    return { success: false, message: `Error: ${e?.message || "Unknown"}` };
  }
}

/**
 * Upload all family data CSVs to Drive
 */
let syncQueue: Promise<unknown> = Promise.resolve();

export function syncAllToDrive(
  membersCSV: string,
  marriagesCSV: string,
  parentChildCSV: string,
): Promise<{ success: boolean; message: string }> {
  // Queue syncs so a manual backup and an automatic one never overlap
  const run = syncQueue.then(() => doSyncAllToDrive(membersCSV, marriagesCSV, parentChildCSV));
  syncQueue = run.catch(() => undefined);
  return run;
}

async function doSyncAllToDrive(
  membersCSV: string,
  marriagesCSV: string,
  parentChildCSV: string,
): Promise<{ success: boolean; message: string }> {
  // Upload one file at a time: in parallel, each upload could create its own app folder
  const results = [
    await uploadCSVToDrive(membersCSV, "members.csv"),
    await uploadCSVToDrive(marriagesCSV, "marriages.csv"),
    await uploadCSVToDrive(parentChildCSV, "parent-child.csv"),
  ];

  const allSuccess = results.every((r) => r.success);
  const failedFiles = results.filter((r) => !r.success).map((r) => r.message);

  if (allSuccess) {
    return { success: true, message: "All files synced to Google Drive successfully!" };
  } else {
    return {
      success: false,
      message: `Some files failed to sync: ${failedFiles.join(", ")}`,
    };
  }
}

/**
 * Download all family data CSVs from Drive
 */
export async function downloadAllFromDrive(): Promise<{
  success: boolean;
  membersCSV?: string;
  marriagesCSV?: string;
  parentChildCSV?: string;
  message: string;
}> {
  const listResult = await listDriveFiles();
  if (!listResult.success || listResult.files.length === 0) {
    return {
      success: false,
      message: listResult.files.length === 0
        ? "No backup files found on Google Drive."
        : (listResult.message || "Failed to list files."),
    };
  }

  let membersCSV: string | undefined;
  let marriagesCSV: string | undefined;
  let parentChildCSV: string | undefined;

  // Files are sorted newest first: keep the newest copy of each file and skip older duplicates
  for (const file of listResult.files) {
    const name = file.name.toLowerCase();
    const kind = name.includes("member") ? "members" : name.includes("marriage") ? "marriages" : name.includes("parent") ? "parentChild" : null;
    if (!kind) continue;
    if ((kind === "members" && membersCSV) || (kind === "marriages" && marriagesCSV) || (kind === "parentChild" && parentChildCSV)) continue;

    const download = await downloadDriveFile(file.id);
    if (download.success && download.content) {
      if (kind === "members") membersCSV = download.content;
      else if (kind === "marriages") marriagesCSV = download.content;
      else parentChildCSV = download.content;
    }
  }

  if (!membersCSV) {
    return { success: false, message: "No members.csv found on Google Drive." };
  }

  return {
    success: true,
    membersCSV,
    marriagesCSV,
    parentChildCSV,
    message: "Downloaded backup from Google Drive successfully!",
  };
}
