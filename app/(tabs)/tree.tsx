import { Text, View, Pressable, ScrollView, Dimensions, TextInput, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useFamily } from "@/lib/family-store";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getDisplayName, Person } from "@/lib/types";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface TreeNode {
  person: Person;
  spouses: Person[];
  children: TreeNode[];
  level: number;
}

function useTreeData() {
  const { data, getChildren, getSpouses } = useFamily();

  return useMemo(() => {
    if (data.persons.length === 0) return null;

    const rootId = data.rootPersonId || data.persons[0]?.id;
    if (!rootId) return null;

    const rootPerson = data.persons.find((p) => p.id === rootId);
    if (!rootPerson) return null;

    const visited = new Set<string>();

    function buildNode(person: Person, level: number): TreeNode {
      if (visited.has(person.id)) {
        return { person, spouses: [], children: [], level };
      }
      visited.add(person.id);

      const spouses = getSpouses(person.id);
      const children = getChildren(person.id);
      const uniqueChildren = children.filter((c) => !visited.has(c.id));

      return {
        person,
        spouses,
        children: uniqueChildren.map((c) => buildNode(c, level + 1)),
        level,
      };
    }

    return buildNode(rootPerson, 0);
  }, [data, getChildren, getSpouses]);
}

// Card-based person node with photo, name, and status
function PersonCard({ person, isRoot, onPress, onAddChild, colors, scale }: {
  person: Person;
  isRoot?: boolean;
  onPress: () => void;
  onAddChild?: () => void;
  colors: ReturnType<typeof useColors>;
  scale: number;
}) {
  const cardW = Math.max(80, Math.round(120 * scale));
  const avatarSize = Math.max(28, Math.round(48 * scale));
  const fontSize = Math.max(9, Math.round(12 * scale));
  const subFontSize = Math.max(7, Math.round(10 * scale));
  const padding = Math.max(6, Math.round(10 * scale));
  const { t } = useI18n();
  const genderColor = person.gender === "male" ? "#4A90D9" : "#E87CA0";

  return (
    <View className="items-center">
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <View
          style={[
            styles.card,
            {
              width: cardW,
              padding,
              borderColor: genderColor,
              backgroundColor: colors.surface,
              borderWidth: isRoot ? 2.5 : 1.5,
              shadowColor: genderColor,
              shadowOpacity: 0.15,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            },
          ]}
        >
          {/* Photo / Avatar */}
          {person.photo ? (
            <Image
              source={{ uri: person.photo }}
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                borderWidth: 2,
                borderColor: genderColor,
              }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                backgroundColor: genderColor + "20",
                borderWidth: 2,
                borderColor: genderColor,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: genderColor, fontWeight: "700", fontSize: avatarSize * 0.4 }}>
                {person.firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Name */}
          <Text
            style={{ fontSize, fontWeight: "600", color: colors.foreground, textAlign: "center", marginTop: 4 }}
            numberOfLines={2}
          >
            {person.prefix ? `${person.prefix} ` : ""}{person.firstName}
          </Text>

          {/* Bin/Binti */}
          {person.binBinti && (
            <Text
              style={{ fontSize: subFontSize, color: colors.muted, textAlign: "center" }}
              numberOfLines={1}
            >
              {person.gender === "male" ? "bin" : "binti"} {person.binBinti}
            </Text>
          )}

          {/* Status indicator */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: person.isAlive ? colors.success : colors.muted }} />
            <Text style={{ fontSize: Math.max(7, Math.round(8 * scale)), color: colors.muted }}>
              {person.isAlive ? t("living") : t("deceased")}
            </Text>
          </View>

          {/* Root badge */}
          {isRoot && (
            <View style={{ backgroundColor: colors.primary + "20", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 }}>
              <Text style={{ color: colors.primary, fontSize: Math.max(7, Math.round(8 * scale)), fontWeight: "700" }}>{t("rootBadge")}</Text>
            </View>
          )}
        </View>
      </Pressable>

      {/* +Add button below card */}
      {onAddChild && scale >= 0.5 && (
        <Pressable
          onPress={onAddChild}
          accessibilityLabel={t("addChild")}
          hitSlop={6}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 4 }]}
        >
          <View style={{
            width: Math.max(18, Math.round(24 * scale)),
            height: Math.max(18, Math.round(24 * scale)),
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Text style={{ color: "#fff", fontSize: Math.max(12, Math.round(16 * scale)), fontWeight: "700", lineHeight: Math.max(14, Math.round(18 * scale)) }}>+</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

// Horizontal marriage connector
function MarriageConnector({ scale, colors }: { scale: number; colors: ReturnType<typeof useColors> }) {
  const lineW = Math.max(12, Math.round(28 * scale));
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: lineW, height: 2, backgroundColor: colors.accent }} />
      <View style={{
        position: "absolute",
        width: Math.max(8, Math.round(12 * scale)),
        height: Math.max(8, Math.round(12 * scale)),
        borderRadius: 6,
        backgroundColor: colors.accent,
      }} />
    </View>
  );
}

// Vertical line connector
function VerticalLine({ height, colors }: { height: number; colors: ReturnType<typeof useColors> }) {
  return <View style={{ width: 2, height, backgroundColor: colors.border, alignSelf: "center" }} />;
}

// Recursive tree node renderer
function TreeNodeView({ node, router, colors, rootId, scale, onAddChild }: {
  node: TreeNode;
  router: ReturnType<typeof useRouter>;
  colors: ReturnType<typeof useColors>;
  rootId?: string;
  scale: number;
  onAddChild: (parentId: string) => void;
}) {
  const gap = Math.max(6, Math.round(12 * scale));
  const verticalGap = Math.max(10, Math.round(20 * scale));
  const hasChildren = node.children.length > 0;

  return (
    <View style={{ alignItems: "center" }}>
      {/* Parent row: person + spouses */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: gap }}>
        <PersonCard
          person={node.person}
          isRoot={node.person.id === rootId}
          onPress={() => router.push({ pathname: "/member-profile" as any, params: { id: node.person.id } })}
          onAddChild={() => onAddChild(node.person.id)}
          colors={colors}
          scale={scale}
        />
        {node.spouses.map((spouse) => (
          <View key={spouse.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: gap }}>
            <MarriageConnector scale={scale} colors={colors} />
            <PersonCard
              person={spouse}
              onPress={() => router.push({ pathname: "/member-profile" as any, params: { id: spouse.id } })}
              colors={colors}
              scale={scale}
            />
          </View>
        ))}
      </View>

      {/* Vertical connector to children */}
      {hasChildren && <VerticalLine height={verticalGap} colors={colors} />}

      {/* Children row */}
      {hasChildren && (
        <View style={{ alignItems: "center" }}>
          {/* Horizontal bracket if multiple children */}
          {node.children.length > 1 && (
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              {node.children.map((child) => (
                <View key={child.person.id} style={{ alignItems: "center", flex: 1 }}>
                  <View style={{ width: 2, height: 8, backgroundColor: colors.border }} />
                </View>
              ))}
            </View>
          )}

          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: Math.max(12, Math.round(24 * scale)) }}>
            {node.children.map((child) => (
              <TreeNodeView
                key={child.person.id}
                node={child}
                router={router}
                colors={colors}
                rootId={rootId}
                scale={scale}
                onAddChild={onAddChild}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export default function TreeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data, getParents, setRootPerson } = useFamily();
  const treeData = useTreeData();
  const { t } = useI18n();

  // The tree is drawn from the root person downwards, so parents of the root are
  // not visible. Offer a one-tap way to move the tree up a generation.
  const rootParents = treeData ? getParents(treeData.person.id) : [];
  const showParents = () => {
    const father = rootParents.find((p) => p.gender === "male");
    setRootPerson((father || rootParents[0]).id);
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(0.85);

  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 2.0;
  const ZOOM_STEP = 0.15;

  const handleZoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)));
  const handleResetZoom = () => setZoom(0.85);

  const handleAddChild = (parentId: string) => {
    router.push({ pathname: "/add-member" as any, params: { parentId } });
  };

  const filteredPersons = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return data.persons.filter((p) =>
      getDisplayName(p).toLowerCase().includes(q) ||
      (p.race && p.race.toLowerCase().includes(q)) ||
      (p.religion && p.religion.toLowerCase().includes(q))
    );
  }, [searchQuery, data.persons]);

  return (
    <ScreenContainer className="pt-2">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 mb-3">
        <View>
          <Text className="text-2xl font-bold text-foreground">{t("familyTree")}</Text>
          <Text className="text-sm text-muted">{data.persons.length} {t("members")}</Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push("/miller-columns" as any)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center">
              <IconSymbol name="list.bullet" size={20} color={colors.foreground} />
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push("/add-member" as any)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="w-10 h-10 rounded-full bg-primary items-center justify-center">
              <IconSymbol name="plus" size={22} color="#fff" />
            </View>
          </Pressable>
        </View>
      </View>

      {/* Search Bar */}
      {data.persons.length > 0 && (
        <View className="px-5 mb-3">
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
      {searchQuery.trim().length > 0 ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            {filteredPersons.length} {filteredPersons.length !== 1 ? t("results") : t("result")}
          </Text>
          {filteredPersons.map((person) => (
            <Pressable
              key={person.id}
              onPress={() => router.push({ pathname: "/member-profile" as any, params: { id: person.id } })}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
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
                  <Text className="text-xs text-muted">
                    {person.isAlive ? t("living") : t("deceased")}
                    {person.race ? ` · ${person.race}` : ""}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </View>
            </Pressable>
          ))}
          {filteredPersons.length === 0 && (
            <View className="items-center py-8">
              <Text className="text-sm text-muted">{t("noMembersFound")} {`"${searchQuery}"`}</Text>
            </View>
          )}
        </ScrollView>
      ) : treeData ? (
        <View className="flex-1">
          {/* Zoom Controls */}
          <View className="flex-row items-center justify-center gap-2 px-5 mb-2">
            <Pressable onPress={handleZoomOut} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <View className="w-9 h-9 rounded-full bg-surface border border-border items-center justify-center">
                <IconSymbol name="minus" size={18} color={colors.primary} />
              </View>
            </Pressable>
            <Pressable onPress={handleResetZoom} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <View className="px-3 py-1.5 rounded-full bg-surface border border-border">
                <Text className="text-xs font-medium" style={{ color: colors.foreground }}>
                  {Math.round(zoom * 100)}%
                </Text>
              </View>
            </Pressable>
            <Pressable onPress={handleZoomIn} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <View className="w-9 h-9 rounded-full bg-surface border border-border items-center justify-center">
                <IconSymbol name="plus" size={18} color={colors.primary} />
              </View>
            </Pressable>
          </View>

          {rootParents.length > 0 && (
            <View className="items-center px-5 mb-2">
              <Pressable onPress={showParents} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View
                  className="flex-row items-center gap-2 rounded-full px-4 py-2 border"
                  style={{ backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" }}
                >
                  <IconSymbol name="arrow.up" size={16} color={colors.primary} />
                  <Text className="text-sm font-medium" style={{ color: colors.primary }} numberOfLines={1}>
                    {t("showParents")}: {rootParents.map((p) => p.firstName).join(" & ")}
                  </Text>
                </View>
              </Pressable>
            </View>
          )}

          {/* Tree View - Scrollable Canvas */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={{ padding: 20, minWidth: Dimensions.get("window").width }}
          >
            <ScrollView
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ alignItems: "center", paddingBottom: 60 }}
            >
              <TreeNodeView
                node={treeData}
                router={router}
                colors={colors}
                rootId={data.rootPersonId}
                scale={zoom}
                onAddChild={handleAddChild}
              />
            </ScrollView>
          </ScrollView>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-4">
            <IconSymbol name="tree" size={40} color={colors.primary} />
          </View>
          <Text className="text-xl font-semibold text-foreground mb-2 text-center">{t("noFamilyTreeYet")}</Text>
          <Text className="text-sm text-muted text-center mb-6">
            {t("addFirstMemberTree")}
          </Text>
          <Pressable
            onPress={() => router.push("/add-member" as any)}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <View className="bg-primary rounded-full px-8 py-3">
              <Text className="text-white font-semibold">{t("addFirstMember")}</Text>
            </View>
          </Pressable>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: 16,
  },
});
