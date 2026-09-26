import { Text, View, Pressable, ScrollView, Alert } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { getDisplayName, Person } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";
import { useMemo } from "react";

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View className="flex-row justify-between py-3 border-b border-border gap-4">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm font-medium text-foreground flex-shrink text-right">{value}</Text>
    </View>
  );
}

function PersonListItem({ person, subtitle, onPress, colors }: {
  person: Person;
  subtitle: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <View className="flex-row items-center bg-surface rounded-xl p-3 border border-border gap-3 mb-2">
        {person.photo ? (
          <Image source={{ uri: person.photo }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
        ) : (
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: (person.isAlive ? colors.primary : colors.muted) + "20" }}
          >
            <Text className="text-sm font-bold" style={{ color: person.isAlive ? colors.primary : colors.muted }}>
              {person.firstName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground">{getDisplayName(person)}</Text>
          <Text className="text-xs text-muted">{subtitle}</Text>
        </View>
        <IconSymbol name="chevron.right" size={14} color={colors.muted} />
      </View>
    </Pressable>
  );
}

function ActionButton({ icon, label, onPress, colors }: {
  icon: any;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}>
      <View className="bg-primary/10 rounded-xl py-3 items-center gap-1">
        <IconSymbol name={icon} size={20} color={colors.primary} />
        <Text className="text-xs font-semibold" style={{ color: colors.primary }}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** Collects the children of every person in `list`, without duplicates. */
function nextGeneration(list: Person[], getChildren: (id: string) => Person[]): Person[] {
  const seen = new Set<string>();
  const result: Person[] = [];
  for (const p of list) {
    for (const c of getChildren(p.id)) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        result.push(c);
      }
    }
  }
  return result;
}

export default function MemberProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { getPersonById, getParents, getChildren, getSpouses, getSiblings, deletePerson, data, setRootPerson } = useFamily();
  const { t, lang } = useI18n();

  const person = getPersonById(id || "");

  // All hooks run before any early return so the hook order never changes (e.g. after deleting this person)
  const family = useMemo(() => {
    if (!person) return null;
    const children = getChildren(person.id);
    const grandchildren = nextGeneration(children, getChildren);
    const greatGrandchildren = nextGeneration(grandchildren, getChildren);
    return {
      parents: getParents(person.id),
      spouses: getSpouses(person.id),
      siblings: getSiblings(person.id),
      children,
      grandchildren,
      greatGrandchildren,
    };
  }, [person, getParents, getChildren, getSpouses, getSiblings]);

  if (!person || !family) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-foreground">{t("personNotFound")}</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <Text className="text-primary mt-4">{t("goBack")}</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const navigateToPerson = (personId: string) => {
    router.push({ pathname: "/member-profile" as any, params: { id: personId } });
  };

  const handleDelete = () => {
    Alert.alert(
      t("deleteMember"),
      `${getDisplayName(person)}\n\n${t("deleteMemberConfirm")}`,
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("delete"), style: "destructive", onPress: () => { router.back(); deletePerson(person.id); } },
      ]
    );
  };

  const isRoot = data.rootPersonId === person.id;
  const statusLabel = (p: Person) => (p.isAlive ? t("living") : t("deceased"));
  const personSubtitle = (p: Person) => statusLabel(p) + (p.birthDate ? ` · ${formatDate(p.birthDate, lang)}` : "");

  const groups: { label: string; persons: Person[] }[] = [
    { label: t("parents"), persons: family.parents },
    { label: t("spouses"), persons: family.spouses },
    { label: t("children"), persons: family.children },
    { label: t("siblings"), persons: family.siblings },
    { label: t("grandchildren"), persons: family.grandchildren },
    { label: t("greatGrandchildren"), persons: family.greatGrandchildren },
  ].filter((g) => g.persons.length > 0);

  const accent = person.isAlive ? colors.primary : colors.muted;

  return (
    <ScreenContainer className="pt-2">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 mb-4">
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
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
            <View className="flex-row items-center gap-1.5 rounded-full bg-surface border border-border px-3 py-2">
              <IconSymbol name="pencil" size={16} color={colors.foreground} />
              <Text className="text-sm font-medium text-foreground">{t("edit")}</Text>
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
        <View className="items-center mb-5">
          {person.photo ? (
            <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: accent, overflow: "hidden", marginBottom: 12 }}>
              <Image source={{ uri: person.photo }} style={{ width: 90, height: 90, borderRadius: 45 }} contentFit="cover" />
            </View>
          ) : (
            <View
              className="w-24 h-24 rounded-full items-center justify-center mb-3"
              style={{ backgroundColor: accent + "15", borderColor: accent, borderWidth: 3 }}
            >
              <Text className="text-3xl font-bold" style={{ color: accent }}>
                {person.firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text className="text-xl font-bold text-foreground text-center">{getDisplayName(person)}</Text>
          <View className="flex-row items-center gap-2 mt-1">
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: person.isAlive ? colors.success : colors.muted }} />
            <Text className="text-sm text-muted">{statusLabel(person)}</Text>
            {isRoot && (
              <View className="bg-primary/15 rounded-full px-2 py-0.5">
                <Text className="text-[11px] font-semibold" style={{ color: colors.primary }}>{t("treeRoot")}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Add relatives */}
        <View className="flex-row gap-2 mb-3">
          <ActionButton
            icon="person.badge.plus"
            label={t("parent")}
            onPress={() => router.push({ pathname: "/add-member" as any, params: { childOfId: person.id } })}
            colors={colors}
          />
          <ActionButton
            icon="heart.fill"
            label={t("spouse")}
            onPress={() => router.push({ pathname: "/add-member" as any, params: { spouseId: person.id } })}
            colors={colors}
          />
          <ActionButton
            icon="person.badge.plus"
            label={t("child")}
            onPress={() => router.push({ pathname: "/add-member" as any, params: { parentId: person.id } })}
            colors={colors}
          />
        </View>

        {!isRoot && (
          <Pressable
            onPress={() => {
              setRootPerson(person.id);
              router.push("/(tabs)/tree");
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <View
              className="flex-row items-center justify-center gap-2 rounded-xl py-3 mb-2"
              style={{ backgroundColor: colors.accent + "15", borderWidth: 1, borderColor: colors.accent + "30" }}
            >
              <IconSymbol name="tree" size={16} color={colors.accent} />
              <Text className="text-sm font-semibold" style={{ color: colors.accent }}>{t("viewAsRoot")}</Text>
            </View>
          </Pressable>
        )}

        {/* Details */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mt-4 mb-2">{t("personalDetails")}</Text>
        <View className="bg-surface rounded-2xl px-4 border border-border mb-2">
          <InfoRow label={t("prefix")} value={person.prefix} />
          <InfoRow label={t("gender")} value={person.gender === "male" ? t("male") : t("female")} />
          <InfoRow label={t("dateOfBirth")} value={formatDate(person.birthDate, lang)} />
          <InfoRow label={t("placeOfBirth")} value={person.birthPlace} />
          {!person.isAlive && <InfoRow label={t("dateOfDeath")} value={formatDate(person.deathDate, lang)} />}
          <InfoRow label={t("ethnicity")} value={person.race} />
          <InfoRow label={t("religion")} value={person.religion} />
        </View>
        {person.bio && (
          <View className="bg-surface rounded-2xl p-4 border border-border mb-2">
            <Text className="text-sm text-foreground leading-relaxed">{person.bio}</Text>
          </View>
        )}

        {/* Family — only non-empty groups are shown */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mt-4 mb-2">{t("family")}</Text>
        {groups.length === 0 ? (
          <View className="items-center py-6">
            <IconSymbol name="person.2.fill" size={32} color={colors.muted} />
            <Text className="text-sm text-muted mt-2 text-center px-6">{t("noRelativesYet")}</Text>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.label} className="mb-3">
              <Text className="text-sm font-semibold text-foreground mb-2">
                {g.label} <Text className="text-muted font-normal">({g.persons.length})</Text>
              </Text>
              {g.persons.map((p) => (
                <PersonListItem
                  key={p.id}
                  person={p}
                  subtitle={personSubtitle(p)}
                  onPress={() => navigateToPerson(p.id)}
                  colors={colors}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
