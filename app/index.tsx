import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Sheet, SheetItem } from "@/components/Sheet";
import { TreeCanvas, type TreeCanvasHandle } from "@/components/TreeCanvas";
import { Button, Icon, IconButton, Muted, Screen } from "@/components/ui";
import { type Card, layoutTree } from "@/lib/layout";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

export default function TreeScreen() {
  const c = useColors();
  const { graph, focusId, setFocus, homeId, treeOptions, setTreeOptions, t, notice, clearNotice } = useStore();
  const canvas = useRef<TreeCanvasHandle>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [optsOpen, setOptsOpen] = useState(false);

  const layout = useMemo(() => (focusId ? layoutTree(graph, focusId, treeOptions) : null), [graph, focusId, treeOptions]);
  const focus = graph.get(focusId);
  const home = graph.get(homeId);
  const title = graph.snapshot.familyName || t("tree");

  const onPressCard = (card: Card) => {
    if (card.add) {
      router.push({ pathname: "/edit", params: { role: card.add.role, of: card.add.of } });
    } else if (card.person) {
      if (card.focus) router.push(`/person/${card.person.id}`);
      else setFocus(card.person.id);
    }
  };
  const onLongPressCard = (card: Card) => {
    if (card.person) router.push(`/person/${card.person.id}`);
  };

  const addRelative = (role: string) => {
    setAddOpen(false);
    if (focus) router.push({ pathname: "/edit", params: { role, of: focus.id } });
  };

  const header = (
    <>
      <IconButton icon="people-outline" label={t("people")} onPress={() => router.push("/people")} />
      <IconButton icon="search" label={t("search")} onPress={() => router.push({ pathname: "/people", params: { search: "1" } })} />
    </>
  );

  if (graph.size === 0 || !layout || !focus) {
    return (
      <Screen title={t("appName")} left={<IconButton icon="menu" label={t("settings")} onPress={() => router.push("/settings")} />}>
        <View style={styles.welcome}>
          <Icon name="account-tree" size={64} color={c.primary} />
          <Text style={[styles.welcomeTitle, { color: c.text }]}>{t("welcomeTitle")}</Text>
          <Muted style={{ textAlign: "center", marginBottom: 24 }}>{t("welcomeBody")}</Muted>
          <Button title={t("addYourself")} icon="person-add" onPress={() => router.push("/edit")} />
          <Button title={t("restoreBackup")} kind="plain" onPress={() => router.push("/settings")} style={{ marginTop: 8 }} />
        </View>
      </Screen>
    );
  }

  const father = graph.father(focus.id);
  const mother = graph.mother(focus.id);
  const hasParents = graph.parents(focus.id).length > 0;

  return (
    <Screen title={title} left={<IconButton icon="menu" label={t("settings")} onPress={() => router.push("/settings")} />} right={header} bg={c.canvas}>
      <TreeCanvas ref={canvas} layout={layout} onPressCard={onPressCard} onLongPressCard={onLongPressCard} onPressFocusAdd={() => setAddOpen(true)} />

      {notice ? (
        <Pressable onPress={clearNotice} style={[styles.notice, { backgroundColor: c.primary }]}>
          <Text style={{ color: c.primaryText, flex: 1 }}>{notice}</Text>
          <Icon name="close" size={20} color={c.primaryText} />
        </Pressable>
      ) : null}

      <View style={styles.fabs}>
        {home && home.id !== focus.id ? (
          <Pressable style={[styles.smallFab, { backgroundColor: c.surface }]} onPress={() => setFocus(home.id)} accessibilityLabel={t("goHome")}>
            <Icon name="home" size={24} color={c.primary} />
          </Pressable>
        ) : null}
        <Pressable style={[styles.smallFab, { backgroundColor: c.surface }]} onPress={() => canvas.current?.recenter()} accessibilityLabel={t("center")}>
          <Icon name="center-focus-strong" size={24} color={c.primary} />
        </Pressable>
        <Pressable style={[styles.fab, { backgroundColor: c.accent }]} onPress={() => setOptsOpen(true)} accessibilityLabel={t("treeOptions")}>
          <Icon name="tune" size={30} color="#fff" />
        </Pressable>
      </View>

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title={focus.givenName}>
        <SheetItem icon="man" label={t("addFather")} onPress={() => addRelative("father")} disabled={!!father} />
        <SheetItem icon="woman" label={t("addMother")} onPress={() => addRelative("mother")} disabled={!!mother} />
        <SheetItem icon="favorite-border" label={t("addSpouse")} onPress={() => addRelative("spouse")} />
        <SheetItem icon="child-care" label={t("addChild")} onPress={() => addRelative("child")} />
        <SheetItem icon="people" label={t("addSibling")} onPress={() => addRelative("sibling")} disabled={!hasParents} />
        <SheetItem
          icon="person"
          label={t("edit")}
          onPress={() => {
            setAddOpen(false);
            router.push(`/person/${focus.id}`);
          }}
        />
      </Sheet>

      <Sheet visible={optsOpen} onClose={() => setOptsOpen(false)} title={t("treeOptions")}>
        <Stepper label={t("generationsUp")} value={treeOptions.up} min={0} max={6} onChange={(up) => setTreeOptions({ ...treeOptions, up })} />
        <Stepper label={t("generationsDown")} value={treeOptions.down} min={0} max={4} onChange={(down) => setTreeOptions({ ...treeOptions, down })} />
        <View style={styles.optRow}>
          <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{t("showPlaceholders")}</Text>
          <Switch value={treeOptions.showAdd} onValueChange={(showAdd) => setTreeOptions({ ...treeOptions, showAdd })} trackColor={{ true: c.primary }} />
        </View>
        <View style={[styles.optRow, { gap: 10 }]}>
          <Button title="−" kind="secondary" onPress={() => canvas.current?.zoomBy(1 / 1.4)} style={{ flex: 1 }} />
          <Button title="+" kind="secondary" onPress={() => canvas.current?.zoomBy(1.4)} style={{ flex: 1 }} />
        </View>
        <Muted style={{ marginTop: 12 }}>{t("tapHint")}</Muted>
      </Sheet>
    </Screen>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const c = useColors();
  return (
    <View style={styles.optRow}>
      <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{label}</Text>
      <IconButton icon="remove-circle-outline" label="-" onPress={() => onChange(Math.max(min, value - 1))} color={c.primary} />
      <Text style={{ color: c.text, fontSize: 18, width: 28, textAlign: "center", fontWeight: "600" }}>{value}</Text>
      <IconButton icon="add-circle-outline" label="+" onPress={() => onChange(Math.min(max, value + 1))} color={c.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  welcome: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  welcomeTitle: { fontSize: 22, fontWeight: "700", marginTop: 16, marginBottom: 8, textAlign: "center" },
  fabs: { position: "absolute", right: 18, bottom: 28, alignItems: "center", gap: 12 },
  fab: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  smallFab: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  notice: { position: "absolute", top: 12, left: 12, right: 12, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  optRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
});
