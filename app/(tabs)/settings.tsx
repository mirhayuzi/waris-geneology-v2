import { Text, View, Pressable, ScrollView, Alert, TextInput, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useFamily } from "@/lib/family-store";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { exportFamilyDataAsCSV } from "@/lib/csv-export";

function SettingsRow({ icon, title, subtitle, onPress, color, danger, rightElement }: {
  icon: any;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  color?: string;
  danger?: boolean;
  rightElement?: React.ReactNode;
}) {
  const colors = useColors();
  const iconColor = danger ? colors.error : (color || colors.foreground);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: onPress && pressed ? 0.7 : 1 }]}>
      <View className="flex-row items-center py-3.5 gap-3">
        <View className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: iconColor + "15" }}>
          <IconSymbol name={icon} size={18} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text className={`text-sm font-medium ${danger ? "text-error" : "text-foreground"}`}>{title}</Text>
          {subtitle && <Text className="text-xs text-muted mt-0.5">{subtitle}</Text>}
        </View>
        {rightElement || (onPress && <IconSymbol name="chevron.right" size={16} color={colors.muted} />)}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data, setFamilyName, resetData } = useFamily();
  const { t, lang, setLang } = useI18n();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(data.familyName);
  const [csvExporting, setCsvExporting] = useState(false);

  const handleExportCSV = async () => {
    if (data.persons.length === 0) {
      Alert.alert(
        lang === "bm" ? "Tiada Data" : "No Data",
        lang === "bm" ? "Sila tambah ahli keluarga sebelum mengeksport." : "Please add family members before exporting."
      );
      return;
    }
    setCsvExporting(true);
    try {
      const result = await exportFamilyDataAsCSV(data.persons, data.marriages, data.parentChildren);
      if (result.success) {
        Alert.alert(
          lang === "bm" ? "Berjaya!" : "Success!",
          result.message + (lang === "bm" ? "\n\nFail disimpan dalam storan aplikasi. Gunakan Backup & Restore untuk hantar ke Google Drive." : "\n\nFiles saved to app storage. Use Backup & Restore to send to Google Drive.")
        );
      } else {
        Alert.alert(lang === "bm" ? "Ralat" : "Error", result.message);
      }
    } catch (e: any) {
      Alert.alert(lang === "bm" ? "Ralat" : "Error", `CSV export failed: ${e?.message || "Unknown error"}`);
    } finally {
      setCsvExporting(false);
    }
  };

  const handleSaveName = () => {
    if (nameInput.trim()) {
      setFamilyName(nameInput.trim());
    }
    setEditingName(false);
  };

  const handleReset = () => {
    Alert.alert(
      t("resetAllData"),
      lang === "bm"
        ? "Ini akan memadam semua ahli keluarga dan hubungan secara kekal. Tindakan ini tidak boleh dibatalkan."
        : "This will permanently delete all family members and relationships. This action cannot be undone.",
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("delete"), style: "destructive", onPress: () => resetData() },
      ]
    );
  };

  return (
    <ScreenContainer className="px-5 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-foreground mb-6">{t("settings")}</Text>

        {/* Family Name */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t("family")}</Text>
        <View className="bg-surface rounded-2xl px-4 border border-border mb-6">
          {editingName ? (
            <View className="flex-row items-center py-3 gap-2">
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                className="flex-1 text-sm text-foreground"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                style={{ color: colors.foreground }}
                placeholderTextColor={colors.muted}
              />
              <Pressable onPress={handleSaveName} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View className="bg-primary rounded-lg px-3 py-1.5">
                  <Text className="text-white text-xs font-medium">{t("save")}</Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <SettingsRow
              icon="pencil"
              title={data.familyName}
              subtitle={t("tapToChangeName")}
              onPress={() => { setNameInput(data.familyName); setEditingName(true); }}
            />
          )}
        </View>

        {/* Language */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t("language")}</Text>
        <View className="flex-row bg-surface rounded-2xl p-1 border border-border mb-6">
          {([["en", "English"], ["bm", "Bahasa Malaysia"]] as const).map(([code, label]) => {
            const active = lang === code;
            return (
              <Pressable
                key={code}
                onPress={() => setLang(code)}
                style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}
              >
                <View
                  className="py-3 rounded-xl items-center"
                  style={{ backgroundColor: active ? colors.primary : "transparent" }}
                >
                  <Text className="text-sm font-semibold" style={{ color: active ? "#fff" : colors.foreground }}>
                    {label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Collaboration */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t("collaboration")}</Text>
        <View className="bg-surface rounded-2xl px-4 border border-border mb-6">
          <SettingsRow
            icon="person.2.fill"
            title={t("inviteFamily")}
            subtitle={
              data.collaborators.length > 0
                ? `${data.collaborators.length} ${data.collaborators.length !== 1 ? t("collaborators") : t("collaborator")}`
                : t("inviteFamilyDesc")
            }
            onPress={() => router.push("/invite-family" as any)}
            color={colors.primary}
          />
        </View>

        {/* Data */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t("data")}</Text>
        <View className="bg-surface rounded-2xl px-4 border border-border mb-6">
          <SettingsRow
            icon="arrow.down.doc.fill"
            title={t("backupRestore")}
            subtitle={t("backupRestoreDesc")}
            onPress={() => router.push("/backup-restore" as any)}
            color="#34C759"
          />
          <View className="h-px bg-border" />
          <SettingsRow
            icon="doc.text.fill"
            title={t("exportCSV")}
            subtitle={t("exportCSVDesc")}
            onPress={handleExportCSV}
            color="#FF9500"
            rightElement={
              csvExporting ? (
                <ActivityIndicator size="small" color="#FF9500" />
              ) : (
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              )
            }
          />
          <View className="h-px bg-border" />
          <SettingsRow
            icon="trash.fill"
            title={t("resetAllData")}
            subtitle={t("deleteAllMembers")}
            onPress={handleReset}
            danger
          />
        </View>

        {/* About */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t("about")}</Text>
        <View className="bg-surface rounded-2xl px-4 border border-border mb-6">
          <SettingsRow icon="info.circle.fill" title="Waris Genealogy" subtitle={`${t("version")} 1.0.0`} />
          <View className="h-px bg-border" />
          <SettingsRow icon="heart.fill" title={t("madeForMalaysia")} subtitle={t("muslimNonMuslim")} color={colors.error} />
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}
