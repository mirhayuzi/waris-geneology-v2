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
  const avatar = card.focus ? 72 : 52;

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
          <View style={{ marginTop: card.focus ? 10 : 8 }}>
            <View style={!p.living && { opacity: 0.55 }}>
              <Avatar person={p} size={avatar} />
            </View>
            <LifeBadge living={p.living} size={card.focus ? 20 : 17} />
          </View>
          {(() => {
            const [l1, l2] = cardName(p);
            // Long names shrink to fit instead of spilling out of the box
            return (
              <View style={styles.names}>
                <Text style={[styles.name, card.focus && styles.nameFocus, { color: c.text }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {p.prefix && card.focus ? `${p.prefix} ` : ""}
                  {l1}
                </Text>
                {l2 ? (
                  <Text style={[styles.sub, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {l2}
                  </Text>
                ) : null}
              </View>
            );
          })()}
          <Text style={[styles.dates, { color: p.living ? c.muted : c.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
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

export const LIVING_COLOR = "#2E9E5B";
export const DECEASED_COLOR = "#6B6B6B";

/** Small badge on the photo: green dot = living, grey flower = deceased. */
export function LifeBadge({ living, size, inline }: { living: boolean; size: number; inline?: boolean }) {
  const c = useColors();
  return (
    <View
      style={[
        styles.badge,
        inline && { position: "relative", right: 0, bottom: 0, borderWidth: 0 },
        { width: size, height: size, borderRadius: size / 2, borderColor: c.surface, backgroundColor: living ? LIVING_COLOR : DECEASED_COLOR },
      ]}
    >
      {living ? null : <Icon name="local-florist" size={size - 7} color="#fff" />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    alignItems: "center",
    paddingHorizontal: 6,
    borderTopWidth: 3,
    borderRadius: 4,
    elevation: 3, // keeps cards above their frames on Android
  },
  names: { flex: 1, width: "100%", justifyContent: "center", marginTop: 4 },
  name: { fontSize: 12.5, textAlign: "center", lineHeight: 15 },
  nameFocus: { fontSize: 14, fontWeight: "600", lineHeight: 17 },
  sub: { fontSize: 11.5, textAlign: "center", lineHeight: 14 },
  dates: { fontSize: 11, textAlign: "center", marginBottom: 6 },
  badge: { position: "absolute", right: -2, bottom: -2, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  addCircle: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  addLabel: { fontSize: 12, textAlign: "center", marginTop: 6 },
  plus: { position: "absolute", top: 2, right: 2, padding: 2 },
});
