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
import { MemberAvatar } from "@/components/member-avatar";

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data } = useFamily();
  const { t } = useI18n();
  const totalMembers = data.persons.length;
  const livingMembers = data.persons.filter((p) => p.isAlive).length;
  const deceasedMembers = totalMembers - livingMembers;
  const totalMarriages = data.marriages.length;
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

  return (
    <ScreenContainer className="px-5 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="mb-4">
          <Text className="text-sm text-muted mb-1">{t("greeting")}</Text>
          <Text className="text-3xl font-bold text-foreground">{data.familyName}</Text>
          <Text className="text-sm text-muted mt-1">
            {totalMembers} {totalMembers === 1 ? t("memberRecorded") : t("membersRecorded")}
          </Text>
        </View>

        {/* Search Bar */}
        {totalMembers > 0 && (
          <View className="mb-4">
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-3 gap-2">
              <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t("searchMembers")}
                placeholderTextColor={colors.muted}
                className="flex-1 py-2.5 text-sm"
                style={{ color: colors.foreground }}
                returnKeyType="done"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                  <IconSymbol name="xmark" size={16} color={colors.muted} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Search Results */}
        {isSearching ? (
          <View>
            <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              {filteredMembers.length} {filteredMembers.length !== 1 ? t("results") : t("result")}
            </Text>
            {filteredMembers.map((person) => (
              <Pressable
                key={person.id}
                onPress={() => router.push({ pathname: "/member-profile" as any, params: { id: person.id } })}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View className="flex-row items-center bg-surface rounded-xl p-3 border border-border gap-3 mb-2">
                  <MemberAvatar person={person} size={40} />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">{getDisplayName(person)}</Text>
                    <Text className="text-xs text-muted">
                      {person.isAlive ? t("living") : t("deceased")}
                      {person.race ? ` · ${person.race}` : ""}
                      {person.birthPlace ? ` · ${person.birthPlace}` : ""}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                </View>
              </Pressable>
            ))}
            {filteredMembers.length === 0 && (
              <View className="items-center py-8">
                <Text className="text-sm text-muted">{t("noMembersFound")} "{searchQuery}"</Text>
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Stats Cards */}
            <View className="flex-row gap-3 mb-6">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-2xl font-bold text-primary">{livingMembers}</Text>
                <Text className="text-xs text-muted mt-1">{t("living")}</Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-2xl font-bold text-foreground">{deceasedMembers}</Text>
                <Text className="text-xs text-muted mt-1">{t("deceased")}</Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-2xl font-bold" style={{ color: colors.accent }}>{totalMarriages}</Text>
                <Text className="text-xs text-muted mt-1">{t("marriages")}</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <Text className="text-lg font-semibold text-foreground mb-3">{t("quickActions")}</Text>
            <View className="gap-3 mb-6">
              {/* Add Member - Primary */}
              <Pressable
                onPress={() => router.push("/add-member" as any)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View className="flex-row items-center bg-primary rounded-2xl p-4 gap-3">
                  <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
                    <IconSymbol name="person.badge.plus" size={22} color="#fff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-white">{t("addFamilyMember")}</Text>
                    <Text className="text-xs text-white/70">{t("recordNewPerson")}</Text>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color="rgba(255,255,255,0.5)" />
                </View>
              </Pressable>

              {/* Row 1: Tree, Miller, Timeline */}
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => router.push("/(tabs)/tree" as any)}
                  style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View className="bg-surface rounded-2xl p-4 border border-border items-center gap-2">
                    <IconSymbol name="tree" size={28} color={colors.primary} />
                    <Text className="text-xs font-medium text-foreground text-center">{t("viewTree")}</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/miller-columns" as any)}
                  style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View className="bg-surface rounded-2xl p-4 border border-border items-center gap-2">
                    <IconSymbol name="list.bullet" size={28} color={colors.primary} />
                    <Text className="text-xs font-medium text-foreground text-center">{t("millerView")}</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/family-timeline" as any)}
                  style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View className="bg-surface rounded-2xl p-4 border border-border items-center gap-2">
                    <IconSymbol name="clock.fill" size={28} color={colors.primary} />
                    <Text className="text-xs font-medium text-foreground text-center">{t("timeline")}</Text>
                  </View>
                </Pressable>
              </View>

              {/* Row 2: Invite, Faraid, Backup */}
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => router.push("/invite-family" as any)}
                  style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View className="bg-surface rounded-2xl p-4 border border-border items-center gap-2">
                    <IconSymbol name="person.2.fill" size={28} color={colors.primary} />
                    <Text className="text-xs font-medium text-foreground text-center">{t("inviteFamily")}</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/(tabs)/tools/faraid-calculator" as any)}
                  style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View className="bg-surface rounded-2xl p-4 border border-border items-center gap-2">
                    <IconSymbol name="chart.pie.fill" size={28} color={colors.primary} />
                    <Text className="text-xs font-medium text-foreground text-center">{t("faraid")}</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/backup-restore" as any)}
                  style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View className="bg-surface rounded-2xl p-4 border border-border items-center gap-2">
                    <IconSymbol name="arrow.down.doc.fill" size={28} color={colors.primary} />
                    <Text className="text-xs font-medium text-foreground text-center">{t("backupRestore")}</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Recent Members */}
            {recentMembers.length > 0 && (
              <>
                <Text className="text-lg font-semibold text-foreground mb-3">{t("recentlyAdded")}</Text>
                <View className="gap-2">
                  {recentMembers.map((person) => (
                    <Pressable
                      key={person.id}
                      onPress={() => router.push({ pathname: "/member-profile" as any, params: { id: person.id } })}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    >
                      <View className="flex-row items-center bg-surface rounded-xl p-3 border border-border gap-3">
                        <MemberAvatar person={person} size={40} />
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-foreground">{getDisplayName(person)}</Text>
                          <Text className="text-xs text-muted">
                            {person.isAlive ? t("living") : t("deceased")}
                            {person.birthDate ? ` · Born ${person.birthDate}` : ""}
                          </Text>
                        </View>
                        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Empty State */}
            {totalMembers === 0 && (
              <View className="items-center py-12">
                <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-4">
                  <IconSymbol name="tree" size={40} color={colors.primary} />
                </View>
                <Text className="text-xl font-semibold text-foreground mb-2">{t("startFamilyTree")}</Text>
                <Text className="text-sm text-muted text-center px-8 mb-6">
                  {t("startFamilyTreeDesc")}
                </Text>
                <Pressable
                  onPress={() => router.push("/add-member" as any)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                >
                  <View className="bg-primary rounded-full px-8 py-3">
                    <Text className="text-white font-semibold text-base">{t("addFirstMember")}</Text>
                  </View>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
