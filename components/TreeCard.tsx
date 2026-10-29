import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
// Gesture-handler's Pressable is cancelled when the canvas starts panning, so a drag never counts as a tap
import { Pressable } from "react-native-gesture-handler";
import { yearOf } from "@/lib/dates";
import type { Card } from "@/lib/layout";
import { cardName, type Person } from "@/lib/model";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";
import { Avatar } from "./Avatar";
import { Icon } from "./ui";

interface Props {
  card: Card;
  onPress: (card: Card) => void;
  onLongPress: (card: Card) => void;
  onPressAdd: () => void;
}

export function lifespan(p: Person, t: ReturnType<typeof useStore>["t"]): string {
  const b = yearOf(p.birthDate);
  const d = yearOf(p.deathDate);
  if (p.living) return b ? `${b}–${t("living")}` : t("living");
  if (b || d) return `${b ?? "?"}–${d ?? "?"}`;
  return t("deceased");
}

/** One half of a couple box on the tree: a person, or an "Add Father / Mother / Spouse" button. */
export const TreeCard = memo(function TreeCard({ card, onPress, onLongPress, onPressAdd }: Props) {
  const c = useColors();
  const { t } = useStore();
  const p = card.person;
  const sex = p?.sex ?? card.add?.sex ?? "male";
  const stripe = sex === "female" ? c.female : c.male;
  const avatar = card.focus ? 78 : 58;

  return (
    <Pressable
      onPress={() => onPress(card)}
      onLongPress={() => onLongPress(card)}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.card,
        { left: card.x, top: card.y, width: card.w, height: card.h, borderTopColor: stripe },
        card.focus && { borderColor: c.focusRing, borderWidth: 2, borderTopWidth: 4, borderRadius: 6 },
        pressed && { backgroundColor: c.surfaceAlt },
      ]}
    >
      {p ? (
        <>
          <View style={{ marginTop: card.focus ? 12 : 10 }}>
            <Avatar person={p} size={avatar} />
          </View>
          {(() => {
            const [l1, l2] = cardName(p);
            return (
              <>
                <Text style={[styles.name, card.focus && styles.nameFocus, { color: c.text }]} numberOfLines={2}>
                  {p.prefix && card.focus ? `${p.prefix} ` : ""}
                  {l1}
                </Text>
                {l2 ? (
                  <Text style={[styles.sub, { color: c.text }]} numberOfLines={1}>
                    {l2}
                  </Text>
                ) : null}
              </>
            );
          })()}
          <Text style={[styles.dates, { color: c.muted }]} numberOfLines={1}>
            {lifespan(p, t)}
          </Text>
          {card.focus ? (
            <Pressable onPress={onPressAdd} hitSlop={10} style={styles.plus} accessibilityLabel={t("add")}>
              <Icon name="add" size={22} color={c.muted} />
            </Pressable>
          ) : null}
        </>
      ) : card.add ? (
        <>
          <View style={[styles.addCircle, { backgroundColor: c.addCircle, marginTop: 10 }]}>
            <Icon name="add" size={40} color="#fff" />
          </View>
          <Text style={[styles.addLabel, { color: c.text }]} numberOfLines={2}>
            {t(card.add.role === "father" ? "addFather" : card.add.role === "mother" ? "addMother" : "addSpouse")}
          </Text>
        </>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    alignItems: "center",
    paddingHorizontal: 6,
    borderTopWidth: 3,
    borderRadius: 4,
    elevation: 3, // keeps cards above their frames on Android
  },
  name: { fontSize: 12.5, textAlign: "center", marginTop: 6, lineHeight: 15 },
  nameFocus: { fontSize: 14, fontWeight: "600", lineHeight: 17 },
  sub: { fontSize: 11.5, textAlign: "center", lineHeight: 14 },
  dates: { fontSize: 11, textAlign: "center", marginTop: 3 },
  addCircle: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  addLabel: { fontSize: 12, textAlign: "center", marginTop: 6 },
  plus: { position: "absolute", top: 2, right: 2, padding: 2 },
});
