import { Text, View, Pressable, ScrollView, TextInput, Alert, Linking, Share } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";

export default function InviteFamilyScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data, addCollaborator, removeCollaborator } = useFamily();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const trimmedEmail = email.trim();
  const trimmedName = name.trim();

  const inviteMessage = () =>
    t("inviteMessage")
      .replace("{family}", data.familyName)
      .replace("{count}", String(data.persons.length));

  // Keep a simple record of who was invited (on this phone only)
  const rememberInvite = () => {
    if (!trimmedEmail && !trimmedName) return;
    const exists = trimmedEmail && data.collaborators.some((c) => c.email.toLowerCase() === trimmedEmail.toLowerCase());
    if (!exists) {
      addCollaborator({ email: trimmedEmail, name: trimmedName || undefined, role: "editor" });
    }
    setEmail("");
    setName("");
  };

  const sendByEmail = async () => {
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      Alert.alert(t("required"), t("invalidEmail"));
      return;
    }
    const greeting = trimmedName ? `${trimmedName},\n\n` : "";
    const url =
      `mailto:${encodeURIComponent(trimmedEmail)}` +
      `?subject=${encodeURIComponent(t("inviteSubject"))}` +
      `&body=${encodeURIComponent(greeting + inviteMessage())}`;
    try {
      await Linking.openURL(url);
      rememberInvite();
    } catch {
      Alert.alert(t("couldNotOpenEmail"), t("tryShareInstead"));
    }
  };

  const shareOtherApps = async () => {
    try {
      await Share.share({ message: inviteMessage(), title: t("inviteSubject") });
      rememberInvite();
    } catch {
      Alert.alert(t("inviteFamily"), t("somethingWentWrong"));
    }
  };

  const handleRemove = (id: string, label: string) => {
    Alert.alert(t("remove"), `${label}\n\n${t("removeInviteConfirm")}`, [
      { text: t("cancel"), style: "cancel" },
      { text: t("remove"), style: "destructive", onPress: () => removeCollaborator(id) },
    ]);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5 pt-2">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="flex-row items-center gap-1">
            <IconSymbol name="xmark" size={20} color={colors.foreground} />
            <Text className="text-sm text-foreground">{t("close")}</Text>
          </View>
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">{t("inviteFamily")}</Text>
        <View className="w-12" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Honest explanation of what an invite does */}
        <View className="rounded-2xl p-4 border mb-6" style={{ backgroundColor: colors.primary + "12", borderColor: colors.primary + "33" }}>
          <Text className="text-sm font-medium text-foreground mb-1">{t("inviteInfoTitle")}</Text>
          <Text className="text-xs text-muted leading-relaxed">{t("inviteInfoDesc")}</Text>
        </View>

        {/* Invite Form */}
        <View className="bg-surface rounded-2xl p-4 border border-border mb-6">
          <Text className="text-xs text-muted mb-1">{t("nameOptional")}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Abang Ali"
            placeholderTextColor={colors.muted}
            className="border border-border rounded-xl px-4 py-3 text-base mb-3"
            style={{ color: colors.foreground }}
          />

          <Text className="text-xs text-muted mb-1">{t("emailAddress")}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="e.g. ali@gmail.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            className="border border-border rounded-xl px-4 py-3 text-base mb-4"
            style={{ color: colors.foreground }}
          />

          <Pressable onPress={sendByEmail} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
            <View className="bg-primary rounded-xl py-3.5 items-center flex-row justify-center gap-2 mb-3">
              <IconSymbol name="envelope.fill" size={18} color="#fff" />
              <Text className="text-white font-semibold text-base">{t("sendByEmail")}</Text>
            </View>
          </Pressable>

          <Pressable onPress={shareOtherApps} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
            <View
              className="rounded-xl py-3.5 items-center flex-row justify-center gap-2 border"
              style={{ borderColor: colors.primary }}
            >
              <IconSymbol name="square.and.arrow.up" size={18} color={colors.primary} />
              <Text className="font-semibold text-base" style={{ color: colors.primary }}>{t("shareOtherApps")}</Text>
            </View>
          </Pressable>
        </View>

        {/* People invited from this phone */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
          {t("invitedPeople")} ({data.collaborators.length})
        </Text>
        {data.collaborators.length === 0 ? (
          <View className="bg-surface rounded-2xl p-6 border border-border items-center">
            <IconSymbol name="person.2.fill" size={32} color={colors.muted} />
            <Text className="text-sm text-muted mt-2 text-center">{t("noInvitesYet")}</Text>
          </View>
        ) : (
          <View className="gap-2">
            {data.collaborators.map((collab) => {
              const label = collab.name || collab.email;
              return (
                <View key={collab.id} className="flex-row items-center bg-surface rounded-xl p-3 border border-border gap-3">
                  <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary + "15" }}>
                    <Text className="text-sm font-bold" style={{ color: colors.primary }}>
                      {(label || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">{label}</Text>
                    {!!collab.name && !!collab.email && <Text className="text-xs text-muted">{collab.email}</Text>}
                  </View>
                  <Pressable
                    onPress={() => handleRemove(collab.id, label)}
                    hitSlop={8}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View className="w-8 h-8 rounded-full bg-error/10 items-center justify-center">
                      <IconSymbol name="xmark" size={14} color={colors.error} />
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
