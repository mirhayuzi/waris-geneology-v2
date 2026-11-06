import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { SkiaTree } from "@/components/SkiaTree";
import { Text } from "@/components/Text";
import { Muted, Screen } from "@/components/ui";
import { isBackgroundId, useTreeBackground } from "@/lib/backgrounds";
import { FamilyGraph } from "@/lib/graph";
import { lineageSnapshot } from "@/lib/kinship";
import { type Card, layoutTree } from "@/lib/layout";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

/**
 * "Lihat dalam salasilah" from the relationship page: a tree with only the shared ancestor
 * and the one line of blood relatives down to each of the two people. Everyone else is left out.
 */
export default function LineageScreen() {
  const c = useColors();
  const { a, b } = useLocalSearchParams<{ a: string; b: string }>();
  const { graph, t, treeOptions } = useStore();
  const background = useTreeBackground(isBackgroundId(treeOptions.background) ? treeOptions.background : "plain");
  const pa = graph.get(a);
  const pb = graph.get(b);

  const layout = useMemo(() => {
    if (!a || !b) return null;
    const line = lineageSnapshot(graph, a, b);
    if (!line) return null;
    // The sub-tree is only the line itself, so it can open all the way down
    return layoutTree(new FamilyGraph(line.snapshot), line.ancestorId, { up: 0, down: 50, showAdd: false });
  }, [graph, a, b]);

  const open = (card: Card) => {
    if (card.person) router.push(`/person/${card.person.id}`);
  };

  return (
    <Screen title={pa && pb ? t("lineageTitle", { a: pa.givenName, b: pb.givenName }) : t("relationship")} back>
      <View style={[styles.hint, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Muted>{t("lineageHint")}</Muted>
      </View>
      {layout ? (
        <View style={{ flex: 1 }}>
          <SkiaTree layout={layout} onPressCard={open} onLongPressCard={open} onPressFocusAdd={() => undefined} onPressBranch={() => undefined} background={background} />
        </View>
      ) : (
        <Text style={{ color: c.muted, textAlign: "center", marginTop: 40 }}>{t("notRelated")}</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
