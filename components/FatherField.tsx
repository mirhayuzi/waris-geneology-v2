import { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { fontFor, Text } from "@/components/Text";
import { yearOf } from "@/lib/dates";
import { fatherCandidates } from "@/lib/match";
import { fullName, type Person, type Sex } from "@/lib/model";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";
import { Avatar } from "./Avatar";
import { Icon, IconButton, Muted } from "./ui";

/**
 * The bin/binti field. While typing, men already in the tree are suggested;
 * picking one links the person to him, so the family stays connected.
 */
export function FatherField({
  sex,
  value,
  onChangeText,
  linked,
  onLink,
  onUnlink,
  canLink,
  childId,
  treeFather,
}: {
  sex: Sex;
  value: string;
  onChangeText: (v: string) => void;
  /** Father picked here (linked on save) */
  linked?: Person;
  onLink: (p: Person) => void;
  onUnlink: () => void;
  /** False when the father comes from somewhere else (adding a child or sibling) */
  canLink: boolean;
  /** When editing: the father already linked in the tree */
  childId?: string;
  treeFather?: Person;
}) {
  const c = useColors();
  const { graph, t } = useStore();
  const [dismissed, setDismissed] = useState<string>();
  const showSuggest = canLink && !linked && !treeFather && dismissed !== value;
  const list = useMemo(() => (showSuggest ? fatherCandidates(graph, value, childId) : []), [graph, value, childId, showSuggest]);

  const details = (p: Person) => {
    const parts: string[] = [];
    const y = yearOf(p.birthDate);
    if (y) parts.push(`${y}`);
    const wives = graph.partners(p.id).map((w) => w.givenName);
    if (wives.length) parts.push(`∞ ${wives.join(", ")}`);
    const kids = graph.childLinksOf(p.id).length;
    if (kids) parts.push(t("nChildren", { n: kids }));
    return parts.join(" · ");
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: c.muted }]}>{t("fatherName")}</Text>
      <View style={[styles.box, { borderColor: linked ? c.primary : c.border, backgroundColor: c.surface }]}>
        <View style={[styles.prefix, { backgroundColor: c.surfaceAlt, borderRightColor: c.border }]}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{t(sex === "female" ? "binti" : "bin")}</Text>
        </View>
        <TextInput
          value={value}
          onChangeText={(v) => {
            if (linked) onUnlink();
            onChangeText(v);
          }}
          placeholder={t("fatherNameHint")}
          placeholderTextColor={c.muted}
          autoCapitalize="words"
          style={[styles.input, { color: c.text, fontFamily: fontFor() }]}
        />
      </View>

      {treeFather ? (
        <View style={styles.chipRow}>
          <Icon name="link" size={18} color={c.primary} />
          <Muted>{t("linkedFather", { name: fullName(treeFather) })}</Muted>
        </View>
      ) : linked ? (
        <View style={[styles.chip, { backgroundColor: c.surfaceAlt, borderColor: c.primary }]}>
          <Icon name="link" size={18} color={c.primary} />
          <Text style={{ color: c.text, flex: 1, fontSize: 14 }} numberOfLines={2}>
            {t("linkedTo", { name: fullName(linked) })}
          </Text>
          <IconButton icon="close" label={t("unlink")} size={18} onPress={onUnlink} />
        </View>
      ) : list.length ? (
        <View style={[styles.suggest, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Muted style={{ paddingHorizontal: 12, paddingTop: 8 }}>{t("fatherSuggest")}</Muted>
          {list.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => {
                onChangeText(p.givenName);
                onLink(p);
              }}
              style={({ pressed }) => [styles.option, { borderBottomColor: c.border }, pressed && { backgroundColor: c.surfaceAlt }]}
            >
              <Avatar person={p} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontSize: 15 }} numberOfLines={1}>
                  {fullName(p)}
                </Text>
                {details(p) ? <Text style={{ color: c.muted, fontSize: 12 }}>{details(p)}</Text> : null}
              </View>
              <Icon name="add-link" size={22} color={c.primary} />
            </Pressable>
          ))}
          <Pressable onPress={() => setDismissed(value)} style={({ pressed }) => [styles.option, { borderBottomWidth: 0 }, pressed && { backgroundColor: c.surfaceAlt }]}>
            <Icon name="edit" size={20} color={c.muted} />
            <Text style={{ color: c.muted, fontSize: 14, flex: 1 }}>{t("nameOnly", { name: value.trim() })}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  box: { flexDirection: "row", borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  prefix: { paddingHorizontal: 12, justifyContent: "center", borderRightWidth: StyleSheet.hairlineWidth, minWidth: 60, alignItems: "center" },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 10, borderRadius: 10, borderWidth: 1 },
  suggest: { marginTop: 6, borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
});
