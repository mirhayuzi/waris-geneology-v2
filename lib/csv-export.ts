import * as FileSystem from "expo-file-system/legacy";
import { Platform, Alert } from "react-native";
import { Person, Marriage, ParentChild } from "./types";

/**
 * CSV Export System
 * Exports family data to CSV with organized folder structure:
 * - family-export/
 *   - members.csv (all family members)
 *   - marriages.csv (spouse relationships)
 *   - parent-child.csv (parent-child relationships)
 *   - photos/ (all member photos)
 *   - export-metadata.json (export info)
 */

export interface CSVExportResult {
  success: boolean;
  folderPath?: string;
  message: string;
  filesCreated?: number;
}

/**
 * Create the export folder structure
 */
async function createExportFolders(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "CSV export is not available on web. Use JSON backup instead.");
      return null;
    }

    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) {
      Alert.alert("Error", "Cannot access device storage");
      return null;
    }

    const exportDir = `${baseDir}family-export`;
    const photosDir = `${exportDir}/photos`;

    // Create main export directory
    await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });

    // Create photos subdirectory
    await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });

    return exportDir;
  } catch (error) {
    console.error("Error creating export folders:", error);
    Alert.alert("Error", `Failed to create export folders: ${error}`);
    return null;
  }
}

/**
 * Convert members array to CSV format
 */
export function membersToCSV(members: Person[]): string {
  const headers = [
    "ID",
    "First Name",
    "Last Name",
    "Prefix/Title",
    "Bin/Binti",
    "Gender",
    "Date of Birth",
    "Place of Birth",
    "Date of Death",
    "Status",
    "Ethnicity/Race",
    "Religion",
    "Photo File",
    "Biography",
  ];

  const rows = members.map((member) => [
    member.id,
    member.firstName,
    member.lastName || "",
    member.prefix || "",
    member.binBinti || "",
    member.gender,
    member.birthDate || "",
    member.birthPlace || "",
    member.deathDate || "",
    member.isAlive ? "Living" : "Deceased",
    member.race || "",
    member.religion || "",
    member.photo ? `photos/${member.id}.jpg` : "",
    member.bio || "",
  ]);

  // Escape CSV values
  const escapeCSV = (value: string) => {
    if (value === null || value === undefined) return '""';
    const stringValue = String(value);
    if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","));

  return [headerLine, ...dataLines].join("\n");
}

/**
 * Convert marriages to CSV format
 */
export function marriagesToCSV(marriages: Marriage[]): string {
  const headers = ["Marriage ID", "Husband ID", "Wife ID", "Marriage Date", "Marriage Place", "Divorce Date", "Status", "Notes"];

  const rows = marriages.map((marriage) => [
    marriage.id,
    marriage.husbandId,
    marriage.wifeId,
    marriage.marriageDate || "",
    marriage.marriagePlace || "",
    marriage.divorceDate || "",
    marriage.isActive ? "Active" : "Divorced",
    marriage.notes || "",
  ]);

  const escapeCSV = (value: string) => {
    if (value === null || value === undefined) return '""';
    const stringValue = String(value);
    if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","));

  return [headerLine, ...dataLines].join("\n");
}

/**
 * Convert parent-child relationships to CSV format
 */
export function parentChildToCSV(parentChildren: ParentChild[]): string {
  const headers = ["Relationship ID", "Parent ID", "Child ID", "Relationship Type"];

  const rows = parentChildren.map((rel) => [rel.id, rel.parentId, rel.childId, rel.type]);

  const escapeCSV = (value: string) => {
    if (value === null || value === undefined) return '""';
    const stringValue = String(value);
    if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","));

  return [headerLine, ...dataLines].join("\n");
}

/**
 * Copy photos to export folder
 */
async function copyPhotosToExport(members: Person[], exportDir: string): Promise<number> {
  let photoCount = 0;

  for (const member of members) {
    if (member.photo) {
      try {
        const photoFileName = `${member.id}.jpg`;
        const destPath = `${exportDir}/photos/${photoFileName}`;

        // If photo is base64, write it as file
        if (member.photo.startsWith("data:image")) {
          const base64Data = member.photo.split(",")[1];
          await FileSystem.writeAsStringAsync(destPath, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else if (member.photo.startsWith("file://") || member.photo.startsWith("/")) {
          // If photo is a file path, copy it
          await FileSystem.copyAsync({
            from: member.photo,
            to: destPath,
          });
        }

        photoCount++;
      } catch (error) {
        console.warn(`Failed to copy photo for ${member.firstName}:`, error);
      }
    }
  }

  return photoCount;
}

/**
 * Create export metadata JSON
 */
function createMetadata(memberCount: number, relationshipCount: number, photoCount: number): string {
  const metadata = {
    exportDate: new Date().toISOString(),
    appName: "Waris Genealogy",
    appVersion: "1.0.0",
    dataStatistics: {
      totalMembers: memberCount,
      totalRelationships: relationshipCount,
      totalPhotos: photoCount,
    },
    fileStructure: {
      "members.csv": "All family members with details",
      "marriages.csv": "Marriage relationships",
      "parent-child.csv": "Parent-child relationships",
      "photos/": "Member photos (named by member ID)",
      "export-metadata.json": "This file",
    },
    instructions: [
      "1. members.csv contains all family member information",
      "2. marriages.csv defines spouse connections",
      "3. parent-child.csv defines parent-child connections",
      "4. photos/ folder contains member photos",
      "5. Use member ID to match photos with CSV entries",
      "6. To import: Use the app's import feature or open with Excel",
    ],
  };

  return JSON.stringify(metadata, null, 2);
}

/**
 * Main export function
 */
export async function exportFamilyDataAsCSV(members: Person[], marriages: Marriage[], parentChildren: ParentChild[]): Promise<CSVExportResult> {
  try {
    // Create folder structure
    const exportDir = await createExportFolders();
    if (!exportDir) {
      return {
        success: false,
        message: "Failed to create export directory",
      };
    }

    // Generate CSV files
    const membersCSV = membersToCSV(members);
    const marriagesCSV = marriagesToCSV(marriages);
    const parentChildCSV = parentChildToCSV(parentChildren);
    const metadata = createMetadata(members.length, marriages.length + parentChildren.length, 0);

    // Write CSV files
    await FileSystem.writeAsStringAsync(`${exportDir}/members.csv`, membersCSV);
    await FileSystem.writeAsStringAsync(`${exportDir}/marriages.csv`, marriagesCSV);
    await FileSystem.writeAsStringAsync(`${exportDir}/parent-child.csv`, parentChildCSV);
    await FileSystem.writeAsStringAsync(`${exportDir}/export-metadata.json`, metadata);

    // Copy photos
    const photoCount = await copyPhotosToExport(members, exportDir);

    return {
      success: true,
      folderPath: exportDir,
      message: `Export successful! Created ${members.length} members, ${marriages.length} marriages, ${parentChildren.length} parent-child links, ${photoCount} photos`,
      filesCreated: 4 + photoCount,
    };
  } catch (error) {
    console.error("CSV export error:", error);
    return {
      success: false,
      message: `Export failed: ${error}`,
    };
  }
}

/**
 * Get export folder path for sharing
 */
export async function getExportFolderPath(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return null;

    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) return null;

    return `${baseDir}family-export`;
  } catch (error) {
    console.error("Error getting export path:", error);
    return null;
  }
}
