import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, useWindowDimensions, View } from "react-native";
import { Text } from "@/components/Text";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Welcome } from "@/components/Welcome";
import { appVersion } from "@/lib/version";
import { releaseToShow } from "@/lib/whatsnew";
import { SkiaTree } from "@/components/SkiaTree";
import { BACKGROUND_IDS, backgroundOf, isBackgroundId, useTreeBackground } from "@/lib/backgrounds";
import { Sheet, SheetItem } from "@/components/Sheet";
import { TreeCanvas, type TreeCanvasHandle } from "@/components/TreeCanvas";
import { LifeBadge } from "@/components/TreeCard";
import { Button, Icon, IconButton, Muted, Screen } from "@/components/ui";
import { shareFile } from "@/lib/files";
import { type Card, DEFAULT_OPTIONS, layoutTree } from "@/lib/layout";
import { fullName } from "@/lib/model";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

export default function TreeScreen() {
  const c = useColors();
  const store = useStore();
  const { graph, focusId, setFocus, homeId, treeOptions, setTreeOptions, treeDrawn, t, notice, clearNotice } = store;
  const [backingUp, setBackingUp] = useState(false);

  // One tap: the full backup (with photos) goes to the share sheet, e.g. Google Drive
  const backupNow = async () => {
    setBackingUp(true);
    try {
      const text = await store.backupText({ photos: true });
      const name = `waris-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (await shareFile(name, text, "application/json")) store.markBackedUp();
    } catch (e) {
      Alert.alert(t("backup"), t("somethingWrong", { msg: String((e as Error)?.message ?? e) }));
    } finally {
      setBackingUp(false);
    }
  };
  const canvas = useRef<TreeCanvasHandle>(null);
  const bgId = isBackgroundId(treeOptions.background) ? treeOptions.background : "plain";
  const background = useTreeBackground(bgId);
  const dark = c.canvas !== backgroundOf("plain", false).bg;
  const [addOpen, setAddOpen] = useState(false);
  const [optsOpen, setOptsOpen] = useState(false);

  // Families folded away with the "−" button (game-style tree only)
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const layout = useMemo(
    () => (focusId ? layoutTree(graph, focusId, treeOptions.classic ? treeOptions : { ...treeOptions, collapsed }) : null),
    [graph, focusId, treeOptions, collapsed],
  );
  const onPressBranch = (card: Card) => {
    const id = card.person?.id;
    if (!id || !card.chip) return;
    if (card.chip.open) setCollapsed((s) => [...s, id]);
    else if (card.hidden !== undefined) setCollapsed((s) => s.filter((x) => x !== id));
    else setFocus(id); // more generations below than shown: move the tree there
  };

  // Once the tree has been on screen for a moment, it drew fine: clear the crash marker
  useEffect(() => {
    const timer = setTimeout(treeDrawn, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);
  // Banner: the centre person's line - them and everyone descended from them
  const stats = useMemo(() => {
    if (!focusId || !graph.get(focusId)) return { people: 0, gens: 0, photos: 0 };
    const gens = graph.descendantsByGeneration(focusId, { includeNonBirth: true });
    const all = [graph.get(focusId)!, ...gens.flat()];
    return { people: all.length, gens: gens.length + 1, photos: all.filter((p) => p.photo).length };
  }, [graph, focusId]);
  const familyName = graph.snapshot.familyName || t("familyOfNone");
  const { height: winH } = useWindowDimensions();
  // a phone turned sideways is short: keep the whole height for the tree
  const showBanner = winH >= 520;

  // Welcome screens (new users) and "What's new" (after an update), each shown once
  const current = appVersion().version;
  const release = store.ready ? releaseToShow(current, store.seenVersion, graph.size > 0) : undefined;
  const [newsOpen, setNewsOpen] = useState(true);
  useEffect(() => {
    if (store.ready && !store.seenVersion && graph.size === 0) store.markVersionSeen(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.ready, store.seenVersion, graph.size]);
  const closeNews = () => {
    setNewsOpen(false);
    store.markVersionSeen(current);
  };

  const focus = graph.get(focusId);
  const home = graph.get(homeId);
  // The title follows whoever the tree is centred on; the saved family name stays underneath
  // With the banner showing "Keturunan <centre person>", the top bar carries the family name;
  // without it (phone sideways), the top bar says whose line it is
  const title = focus && !showBanner ? t("descendantsOf", { name: fullName(focus) }) : graph.snapshot.familyName || t("appName");
  const subtitle = undefined;
  const bannerTitle = focus ? t("descendantsOf", { name: fullName(focus) }) : familyName;
  const crest = (focus?.givenName ?? familyName).trim().charAt(0).toUpperCase();

  const onPressCard = (card: Card) => {
    if (card.add) {
      router.push({
        pathname: "/edit",
        params: { role: card.add.role, of: card.add.of },
      });
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
        <Welcome visible={!store.onboarded} onDone={store.markOnboarded} />
      </Screen>
    );
  }

  const father = graph.father(focus.id);
  const mother = graph.mother(focus.id);
  const hasParents = graph.parents(focus.id).length > 0;

  return (
    <Screen
      wide
      title={title}
      subtitle={subtitle}
      left={<IconButton icon="menu" label={t("settings")} onPress={() => router.push("/settings")} />}
      right={header}
      bg={background.bg}
    >
      {showBanner ? (
        <Pressable onPress={() => focus && router.push(`/person/${focus.id}`)} accessibilityRole="button" accessibilityLabel={bannerTitle} style={styles.banner}>
          <View style={styles.crest}>
            <Text style={styles.crestText}>{crest}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={styles.bannerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {bannerTitle}
            </Text>
            <View style={styles.chips}>
              <Text style={[styles.chip, styles.chipGold]}>{t("bannerPeople", { n: stats.people })}</Text>
              <Text style={styles.chip}>{t("bannerGens", { n: stats.gens })}</Text>
              <Text style={styles.chip}>{t("bannerPhotos", { n: stats.photos })}</Text>
            </View>
          </View>
        </Pressable>
      ) : null}
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View style={{ flex: 1 }}>
          <ErrorBoundary
            fallback={(reset) => (
              <View style={styles.welcome}>
                <Icon name="warning-amber" size={48} color={c.danger} />
                <Muted style={{ textAlign: "center", marginVertical: 16 }}>{t("treeError")}</Muted>
                <Button
                  title={t("resetView")}
                  icon="restart-alt"
                  onPress={() => {
                    setTreeOptions({ ...DEFAULT_OPTIONS, classic: true });
                    reset();
                  }}
                />
              </View>
            )}
          >
            {treeOptions.classic ? (
              <TreeCanvas ref={canvas} layout={layout} onPressCard={onPressCard} onLongPressCard={onLongPressCard} onPressFocusAdd={() => setAddOpen(true)} background={background} />
            ) : (
              <SkiaTree
                ref={canvas}
                layout={layout}
                onPressCard={onPressCard}
                onLongPressCard={onLongPressCard}
                onPressFocusAdd={() => setAddOpen(true)}
                onPressBranch={onPressBranch}
                background={background}
              />
            )}
          </ErrorBoundary>

          {notice ? (
            <Pressable onPress={clearNotice} style={[styles.notice, { backgroundColor: c.primary }]}>
              <Text style={{ color: c.primaryText, flex: 1 }}>{notice}</Text>
              <Icon name="close" size={20} color={c.primaryText} />
            </Pressable>
          ) : store.backupDue ? (
            <View
              style={[
                styles.notice,
                {
                  backgroundColor: c.surface,
                  borderColor: c.focusRing,
                  borderWidth: 1.5,
                  flexDirection: "column",
                  alignItems: "stretch",
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name="cloud-upload" size={26} color={c.focusRing} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>{t("backupRemindTitle")}</Text>
                  <Muted>{t("backupRemindBody", { n: store.changesSinceBackup })}</Muted>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <Button title={t("later")} kind="secondary" onPress={store.snoozeBackup} disabled={backingUp} style={{ flex: 1, height: 40 }} />
                <Button title={t("backupNow")} icon="backup" onPress={backupNow} disabled={backingUp} style={{ flex: 1, height: 40 }} />
              </View>
              {backingUp ? <ActivityIndicator color={c.primary} style={{ marginTop: 8 }} /> : null}
            </View>
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
        </View>
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
        <View style={styles.optRow}>
          <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{t("classicTree")}</Text>
          <Switch value={!!treeOptions.classic} onValueChange={(classic) => setTreeOptions({ ...treeOptions, classic })} trackColor={{ true: c.primary }} />
        </View>
        <Text style={{ color: c.text, fontSize: 16, marginTop: 8 }}>{t("background")}</Text>
        <View style={styles.swatches}>
          {BACKGROUND_IDS.map((id) => {
            const b = backgroundOf(id, dark);
            const on = id === bgId;
            return (
              <Pressable
                key={id}
                onPress={() => setTreeOptions({ ...treeOptions, background: id })}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t(`bg_${id}`)}
                style={styles.swatchBox}
              >
                <View style={[styles.swatch, { backgroundColor: b.bg, borderColor: on ? c.focusRing : c.border, borderWidth: on ? 3 : 1 }]}>
                  {b.bg2 ? <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "50%", backgroundColor: b.bg2 }} /> : null}
                  <View style={{ width: 18, height: 2, backgroundColor: b.line }} />
                  <View style={{ flexDirection: "row", gap: 3, marginTop: 3 }}>
                    <View style={[styles.mini, { backgroundColor: c.surface }]} />
                    <View style={[styles.mini, { backgroundColor: c.surface }]} />
                  </View>
                </View>
                <Text style={{ color: on ? c.text : c.muted, fontSize: 12, fontWeight: on ? "700" : "400" }} numberOfLines={1}>
                  {t(`bg_${id}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.optRow, { gap: 10 }]}>
          <Button title="−" kind="secondary" onPress={() => canvas.current?.zoomBy(1 / 1.4)} style={{ flex: 1 }} />
          <Button title="+" kind="secondary" onPress={() => canvas.current?.zoomBy(1.4)} style={{ flex: 1 }} />
        </View>
        <View style={[styles.optRow, { gap: 8 }]}>
          <LifeBadge living size={16} inline />
          <Muted>{t("living")}</Muted>
          <View style={{ width: 12 }} />
          <LifeBadge living={false} size={16} inline />
          <Muted>{t("deceased")}</Muted>
        </View>
        <Muted style={{ marginTop: 12 }}>{t("tapHint")}</Muted>
      </Sheet>
      <Sheet visible={!!release && newsOpen} onClose={closeNews} title={t("whatsNewIn", { v: current })}>
        {release?.notes[store.lang === "bm" ? "bm" : "en"].map((n) => (
          <View key={n} style={styles.newsRow}>
            <View style={styles.newsDot} />
            <Text style={{ color: c.text, fontSize: 15, lineHeight: 22, flex: 1 }}>{n}</Text>
          </View>
        ))}
        <Button title={t("ok")} onPress={closeNews} style={{ marginTop: 16 }} />
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
      <Text
        style={{
          color: c.text,
          fontSize: 18,
          width: 28,
          textAlign: "center",
          fontWeight: "600",
        }}
      >
        {value}
      </Text>
      <IconButton icon="add-circle-outline" label="+" onPress={() => onChange(Math.min(max, value + 1))} color={c.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  welcome: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  fabs: {
    position: "absolute",
    right: 18,
    bottom: 28,
    alignItems: "center",
    gap: 12,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  smallFab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  notice: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#2E3F8F" },
  crest: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: "#F2B92B", backgroundColor: "#24337A", alignItems: "center", justifyContent: "center" },
  crestText: { color: "#F2B92B", fontSize: 20, fontWeight: "800" },
  bannerTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { color: "#FFFFFF", backgroundColor: "#3D51A8", fontSize: 12, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9, overflow: "hidden" },
  chipGold: { color: "#1A1D2E", backgroundColor: "#F2B92B" },
  newsRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 5 },
  newsDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#D49A00", marginTop: 8 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingVertical: 8 },
  swatchBox: { alignItems: "center", gap: 4, width: 56 },
  swatch: { width: 52, height: 52, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  mini: { width: 12, height: 14, borderRadius: 2 },
  optRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
});
