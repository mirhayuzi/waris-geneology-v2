import { Text, View, Pressable, ScrollView, Alert, FlatList, InteractionManager } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { getDisplayName, Person } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useState, useMemo } from "react";
import { MemberAvatar } from "@/components/member-avatar";
import { generateFamilyPdf } from "@/lib/exports/family-pdf";

type TabKey = "details" | "spouse" | "parents" | "children" | "grandchildren" | "great-grandchildren" | "siblings";

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View className="flex-row justify-between py-2.5 border-b border-border">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm font-medium text-foreground flex-shrink" numberOfLines={1}>{value}</Text>
    </View>
  );
}

function PersonListItem({ person, onPress, colors }: {
  person: Person;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useI18n();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <View className="flex-row items-center bg-surface rounded-xl p-3 border border-border gap-3 mb-2">
        <MemberAvatar person={person} size={40} />
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground">{getDisplayName(person)}</Text>
          <Text className="text-xs text-muted">
            {person.isAlive ? t("living") : t("deceased")}
            {person.birthDate ? ` · b. ${person.birthDate}` : ""}
          </Text>
        </View>
        <IconSymbol name="chevron.right" size={14} color={colors.muted} />
      </View>
    </Pressable>
  );
}

export default function MemberProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { getPersonById, getParents, getChildren, getSpouses, getSiblings, deletePerson, data, setRootPerson } = useFamily();
  const { t, lang } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>("details");
  const [exporting, setExporting] = useState(false);

  const person = getPersonById(id || "");
  if (!person) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-foreground">Person not found</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <Text className="text-primary mt-4">Go Back</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const parents = getParents(person.id);
  const children = getChildren(person.id);
  const spouses = getSpouses(person.id);
  const siblings = getSiblings(person.id);

  // Compute grandchildren: children of children
  const grandchildren = useMemo(() => {
    const result: Person[] = [];
    const seen = new Set<string>();
    for (const child of children) {
      for (const gc of getChildren(child.id)) {
        if (!seen.has(gc.id)) {
          seen.add(gc.id);
          result.push(gc);
        }
      }
    }
    return result;
  }, [children, getChildren]);

  // Compute great-grandchildren: children of grandchildren
  const greatGrandchildren = useMemo(() => {
    const result: Person[] = [];
    const seen = new Set<string>();
    for (const gc of grandchildren) {
      for (const ggc of getChildren(gc.id)) {
        if (!seen.has(ggc.id)) {
          seen.add(ggc.id);
          result.push(ggc);
        }
      }
    }
    return result;
  }, [grandchildren, getChildren]);

  const navigateToPerson = (personId: string) => {
    router.push({ pathname: "/member-profile" as any, params: { id: personId } });
  };

  const handleDelete = () => {
    Alert.alert(
      t("delete"),
      lang === "bm"
        ? `Adakah anda pasti mahu membuang ${getDisplayName(person)} dari salasilah keluarga?`
        : `Are you sure you want to remove ${getDisplayName(person)} from the family tree?`,
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: () => {
            const idToDelete = person.id;
            router.back();
            // Wait for the navigation transition to finish before mutating state —
            // setTimeout(0) fires before the animation completes and can still
            // trigger a re-render of this screen with a null person.
            InteractionManager.runAfterInteractions(() => {
              deletePerson(idToDelete);
            });
          },
        },
      ]
    );
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await generateFamilyPdf(person.id, data);
    } catch {
      Alert.alert("Export Gagal", "Tidak dapat menjana PDF. Sila cuba lagi.");
    } finally {
      setExporting(false);
    }
  };

  const isRoot = data.rootPersonId === person.id;

  // Tab definitions with counts
  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "details", label: t("personalDetails") },
    { key: "spouse", label: t("spousesLabel"), count: spouses.length },
    { key: "parents", label: t("parentsLabel"), count: parents.length },
    { key: "children", label: t("childrenLabel"), count: children.length },
    { key: "grandchildren", label: t("grandchildren"), count: grandchildren.length },
    { key: "great-grandchildren", label: t("greatGrandchildren"), count: greatGrandchildren.length },
    { key: "siblings", label: t("siblingsLabel"), count: siblings.length },
  ];

  const getTabContent = () => {
    switch (activeTab) {
      case "details":
        return (
          <View className="bg-surface rounded-2xl px-4 border border-border">
            <InfoRow label={t("prefix")} value={person.prefix} />
            <InfoRow label={t("firstName")} value={person.firstName} />
            <InfoRow label={person.gender === "male" ? t("bin") : t("binti")} value={person.binBinti} />
            <InfoRow label={t("lastName")} value={person.lastName} />
            <InfoRow label={t("gender")} value={person.gender === "male" ? t("male") : t("female")} />
            <InfoRow label={t("dateOfBirth")} value={person.birthDate} />
            <InfoRow label={t("placeOfBirth")} value={person.birthPlace} />
            {!person.isAlive && <InfoRow label={t("dateOfDeath")} value={person.deathDate} />}
            <InfoRow label={t("ethnicity")} value={person.race} />
            <InfoRow label={t("religion")} value={person.religion} />
            {person.bio && <InfoRow label={t("notes")} value={person.bio} />}
          </View>
        );
      case "spouse":
        return renderPersonList(spouses, lang === "bm" ? "Tiada pasangan direkodkan" : "No spouse recorded");
      case "parents":
        return renderPersonList(parents, lang === "bm" ? "Tiada ibu bapa direkodkan" : "No parents recorded");
      case "children":
        return renderPersonList(children, lang === "bm" ? "Tiada anak direkodkan" : "No children recorded");
      case "grandchildren":
        return renderPersonList(grandchildren, lang === "bm" ? "Tiada cucu direkodkan" : "No grandchildren recorded");
      case "great-grandchildren":
        return renderPersonList(greatGrandchildren, lang === "bm" ? "Tiada cicit direkodkan" : "No great-grandchildren recorded");
      case "siblings":
        return renderPersonList(siblings, lang === "bm" ? "Tiada adik-beradik direkodkan" : "No siblings recorded");
      default:
        return null;
    }
  };

  const renderPersonList = (persons: Person[], emptyMsg: string) => {
    if (persons.length === 0) {
      return (
        <View className="items-center py-8">
          <IconSymbol name="person.fill" size={32} color={colors.muted} />
          <Text className="text-sm text-muted mt-2">{emptyMsg}</Text>
        </View>
      );
    }
    return (
      <View>
        {persons.map((p) => (
          <PersonListItem key={p.id} person={p} onPress={() => navigateToPerson(p.id)} colors={colors} />
        ))}
      </View>
    );
  };

  return (
    <ScreenContainer className="pt-2">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 mb-4">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="flex-row items-center gap-1">
            <IconSymbol name="chevron.left" size={20} color={colors.primary} />
            <Text className="text-sm" style={{ color: colors.primary }}>{t("back")}</Text>
          </View>
        </Pressable>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push({ pathname: "/edit-member" as any, params: { id: person.id } })}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="w-9 h-9 rounded-full bg-surface border border-border items-center justify-center">
              <IconSymbol name="pencil" size={16} color={colors.foreground} />
            </View>
          </Pressable>
          <Pressable onPress={handleDelete} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <View className="w-9 h-9 rounded-full bg-error/10 items-center justify-center">
              <IconSymbol name="trash.fill" size={16} color={colors.error} />
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}>
        {/* Profile Header */}
        <View className="items-center mb-4">
          {person.photo ? (
            <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: person.isAlive ? colors.primary : colors.muted, overflow: "hidden", marginBottom: 12 }}>
              <Image source={{ uri: person.photo }} style={{ width: 90, height: 90, borderRadius: 45 }} contentFit="cover" />
            </View>
          ) : (
            <View
              className="w-24 h-24 rounded-full items-center justify-center mb-3"
              style={{
                backgroundColor: (person.isAlive ? colors.primary : colors.muted) + "15",
                borderColor: person.isAlive ? colors.primary : colors.muted,
                borderWidth: 3,
              }}
            >
              <Text className="text-3xl font-bold" style={{ color: person.isAlive ? colors.primary : colors.muted }}>
                {person.firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text className="text-xl font-bold text-foreground text-center">{getDisplayName(person)}</Text>
          <View className="flex-row items-center gap-2 mt-1">
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: person.isAlive ? colors.success : colors.muted }}
            />
            <Text className="text-sm text-muted">{person.isAlive ? t("living") : t("deceased")}</Text>
            {isRoot && (
              <View className="bg-primary/15 rounded-full px-2 py-0.5">
                <Text className="text-[10px] font-semibold" style={{ color: colors.primary }}>ROOT</Text>
              </View>
            )}
          </View>

          {/* Family Summary Stats */}
          <View className="flex-row items-center gap-4 mt-3">
            {spouses.length > 0 && (
              <View className="items-center">
                <Text className="text-lg font-bold text-foreground">{spouses.length}</Text>
                <Text className="text-[10px] text-muted">{t("spouses")}</Text>
              </View>
            )}
            {children.length > 0 && (
              <View className="items-center">
                <Text className="text-lg font-bold text-foreground">{children.length}</Text>
                <Text className="text-[10px] text-muted">{t("children")}</Text>
              </View>
            )}
            {grandchildren.length > 0 && (
              <View className="items-center">
                <Text className="text-lg font-bold text-foreground">{grandchildren.length}</Text>
                <Text className="text-[10px] text-muted">{t("grandchild")}</Text>
              </View>
            )}
            {greatGrandchildren.length > 0 && (
              <View className="items-center">
                <Text className="text-lg font-bold text-foreground">{greatGrandchildren.length}</Text>
                <Text className="text-[10px] text-muted">{t("greatGrandchild")}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View className="flex-row gap-2 mb-3">
          <Pressable
            onPress={() => router.push({ pathname: "/add-member" as any, params: { parentId: person.id } })}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="bg-primary/10 rounded-xl py-3 items-center">
              <Text className="text-xs font-medium" style={{ color: colors.primary }}>{t("addChild")}</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: "/add-member" as any, params: { spouseId: person.id } })}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="bg-primary/10 rounded-xl py-3 items-center">
              <Text className="text-xs font-medium" style={{ color: colors.primary }}>{t("addSpouse")}</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: "/add-member" as any, params: { childOfId: person.id } })}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="bg-primary/10 rounded-xl py-3 items-center">
              <Text className="text-xs font-medium" style={{ color: colors.primary }}>{t("addParent")}</Text>
            </View>
          </Pressable>
        </View>

        {/* Export Family PDF */}
        <Pressable
          onPress={exporting ? undefined : handleExportPdf}
          style={({ pressed }) => [{ opacity: exporting ? 0.5 : pressed ? 0.8 : 1, marginBottom: 8 }]}
        >
          <View
            className="flex-row items-center justify-center gap-2 rounded-xl py-3"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <IconSymbol name="arrow.down.doc.fill" size={16} color={colors.foreground} />
            <Text className="text-sm font-medium text-foreground">
              {exporting ? "Menjana PDF..." : "Eksport Keluarga ke PDF"}
            </Text>
          </View>
        </Pressable>

        {/* View as Root */}
        {!isRoot && (
          <Pressable
            onPress={() => {
              setRootPerson(person.id);
              Alert.alert(t("setRoot"), `${person.firstName} ${t("viewAsRootDesc")}`);
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <View className="flex-row items-center justify-center gap-2 rounded-xl py-3 mb-4" style={{ backgroundColor: colors.accent + "15", borderWidth: 1, borderColor: colors.accent + "30" }}>
              <IconSymbol name="tree" size={16} color={colors.accent} />
              <Text className="text-sm font-semibold" style={{ color: colors.accent }}>{t("viewAsRoot")}</Text>
            </View>
          </Pressable>
        )}
        {isRoot && <View className="mb-2" />}

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, marginBottom: 12 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View
                  className="rounded-full px-3 py-2 flex-row items-center gap-1"
                  style={{
                    backgroundColor: isActive ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: isActive ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: isActive ? "#fff" : colors.foreground }}
                  >
                    {tab.label}
                  </Text>
                  {tab.count !== undefined && tab.count > 0 && (
                    <View
                      className="rounded-full px-1.5 py-0.5 min-w-[18px] items-center"
                      style={{ backgroundColor: isActive ? "rgba(255,255,255,0.3)" : colors.primary + "20" }}
                    >
                      <Text
                        className="text-[10px] font-bold"
                        style={{ color: isActive ? "#fff" : colors.primary }}
                      >
                        {tab.count}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Tab Content */}
        {getTabContent()}
      </ScrollView>
    </ScreenContainer>
  );
}
