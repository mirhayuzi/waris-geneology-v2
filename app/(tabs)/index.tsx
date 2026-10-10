import { ScrollView, Text, View, Pressable, TextInput } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useFamily } from "@/lib/family-store";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getDisplayName, Person } from "@/lib/types";
import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";

function MemberAvatar({ person, size, colors }: {
  person: Person;
  size: number;
  colors: ReturnType<typeof useColors>;
}) {
  if (person.photo) {
    return (
      <Image
        source={{ uri: person.photo }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }
  const bgColor = person.isAlive ? colors.primary + "20" : colors.muted + "20";
  const textColor = person.isAlive ? colors.primary : colors.muted;
  return (
    <View
      className="items-center justify-center"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor }}
    >
      <Text className="font-bold" style={{ color: textColor, fontSize: size * 0.4 }}>
        {person.firstName.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function MemberRow({ person, subtitle, onPress, colors }: {
  person: Person;
  subtitle: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <View className="flex-row items-center bg-surface rounded-xl p-3 border border-border gap-3 mb-2">
        <MemberAvatar person={person} size={44} colors={colors} />
        <View className="flex-1">
          <Text className="text-base font-medium text-foreground" numberOfLines={1}>{getDisplayName(person)}</Text>
          <Text className="text-xs text-muted" numberOfLines={1}>{subtitle}</Text>
        </View>
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </View>
    </Pressable>
  );
}

function Shortcut({ icon, label, onPress, colors }: {
  icon: any;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}>
      <View className="bg-surface rounded-2xl py-4 px-2 border border-border items-center gap-2">
        <IconSymbol name={icon} size={28} color={colors.primary} />
        <Text className="text-xs font-medium text-foreground text-center" numberOfLines={2}>{label}</Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data } = useFamily();
  const { t } = useI18n();
  const totalMembers = data.persons.length;
  const livingMembers = data.persons.filter((p) => p.isAlive).length;
  const deceasedMembers = totalMembers - livingMembers;
  const [searchQuery, setSearchQuery] = useState("");

  const recentMembers = useMemo(() =>
    [...data.persons]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5),
    [data.persons]
  );

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return data.persons.filter((p) =>
      getDisplayName(p).toLowerCase().includes(q) ||
      (p.race && p.race.toLowerCase().includes(q)) ||
      (p.religion && p.religion.toLowerCase().includes(q)) ||
      (p.birthPlace && p.birthPlace.toLowerCase().includes(q))
    );
  }, [searchQuery, data.persons]);

  const isSearching = searchQuery.trim().length > 0;
  const openProfile = (id: string) => router.push({ pathname: "/member-profile" as any, params: { id } });
  const statusText = (person: Person) =>
    (person.isAlive ? t("living") : t("deceased")) + (person.birthDate ? ` · ${person.birthDate}` : "");

  // First-time user: show only a friendly welcome and one clear action
  if (totalMembers === 0) {
    return (
      <ScreenContainer className="px-5 pt-2">
        <View className="mb-4">
          <Text className="text-sm text-muted mb-1">{t("greeting")}</Text>
          <Text className="text-3xl font-bold text-foreground">{data.familyName}</Text>
        </View>
        <View className="flex-1 items-center justify-center pb-16">
          <View className="w-24 h-24 rounded-full bg-primary/10 items-center justify-center mb-5">
            <IconSymbol name="tree" size={48} color={colors.primary} />
          </View>
          <Text className="text-2xl font-semibold text-foreground mb-2 text-center">{t("startFamilyTree")}</Text>
          <Text className="text-base text-muted text-center px-6 mb-8">{t("startFamilyTreeDesc")}</Text>
          <Pressable
            onPress={() => router.push("/add-member" as any)}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <View className="flex-row items-center gap-2 bg-primary rounded-full px-8 py-4">
              <IconSymbol name="person.badge.plus" size={22} color="#fff" />
              <Text className="text-white font-semibold text-base">{t("addFirstMember")}</Text>
            </View>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-5 pt-2">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <View className="mb-4">
          <Text className="text-sm text-muted mb-1">{t("greeting")}</Text>
          <Text className="text-3xl font-bold text-foreground">{data.familyName}</Text>
          <Text className="text-sm text-muted mt-1">
            {totalMembers} {totalMembers === 1 ? t("memberRecorded") : t("membersRecorded")}
            {" · "}{livingMembers} {t("living").toLowerCase()}
            {" · "}{deceasedMembers} {t("deceased").toLowerCase()}
          </Text>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-3 gap-2 mb-4">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("searchMembers")}
            placeholderTextColor={colors.muted}
            className="flex-1 py-3 text-base"
            style={{ color: colors.foreground }}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={10} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <IconSymbol name="xmark" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {isSearching ? (
          <View>
            <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              {filteredMembers.length} {filteredMembers.length !== 1 ? t("results") : t("result")}
            </Text>
            {filteredMembers.map((person) => (
              <MemberRow
                key={person.id}
                person={person}
                subtitle={statusText(person) + (person.birthPlace ? ` · ${person.birthPlace}` : "")}
                onPress={() => openProfile(person.id)}
                colors={colors}
              />
            ))}
            {filteredMembers.length === 0 && (
              <View className="items-center py-8">
                <Text className="text-sm text-muted">{t("noMembersFound")} {`"${searchQuery}"`}</Text>
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Main action */}
            <Pressable
              onPress={() => router.push("/add-member" as any)}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <View className="flex-row items-center bg-primary rounded-2xl p-4 gap-3 mb-4">
                <View className="w-11 h-11 rounded-full bg-white/20 items-center justify-center">
                  <IconSymbol name="person.badge.plus" size={24} color="#fff" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-white">{t("addFamilyMember")}</Text>
                  <Text className="text-xs text-white/80">{t("recordNewPerson")}</Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color="rgba(255,255,255,0.6)" />
              </View>
            </Pressable>

            {/* Shortcuts: the most common places, everything else is in Tools / Settings */}
            <View className="flex-row gap-3 mb-6">
              <Shortcut icon="tree" label={t("viewTree")} onPress={() => router.push("/(tabs)/tree")} colors={colors} />
              <Shortcut icon="clock.fill" label={t("timeline")} onPress={() => router.push("/family-timeline" as any)} colors={colors} />
              <Shortcut icon="arrow.down.doc.fill" label={t("backupRestore")} onPress={() => router.push("/backup-restore" as any)} colors={colors} />
            </View>

            {/* Recent Members */}
            <Text className="text-lg font-semibold text-foreground mb-3">{t("recentlyAdded")}</Text>
            {recentMembers.map((person) => (
              <MemberRow
                key={person.id}
                person={person}
                subtitle={statusText(person)}
                onPress={() => openProfile(person.id)}
                colors={colors}
              />
            ))}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
