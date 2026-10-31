import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStore } from "@/lib/store";
import { Text } from "./Text";
import { Icon, type IconName } from "./ui";

const LOGO = require("@/assets/images/favicon.png");
const INDIGO = "#2E3F8F";
const KUNYIT = "#F2B92B";
const RING = "#3D51A8";

const SLIDES: { title: "wTitle1" | "wTitle2" | "wTitle3"; body: "wBody1" | "wBody2" | "wBody3"; icon?: IconName }[] = [
  { title: "wTitle1", body: "wBody1" },
  { title: "wTitle2", body: "wBody2", icon: "device-hub" },
  { title: "wTitle3", body: "wBody3", icon: "verified-user" },
];

/** Three short welcome screens, shown once to a brand-new user. */
export function Welcome({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const { t } = useStore();
  const [i, setI] = useState(0);
  const { width, height } = useWindowDimensions();
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  const art = Math.min(150, height * 0.22);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onDone} statusBarTranslucent supportedOrientations={["portrait", "landscape"]}>
      <View style={styles.root}>
        {/* soft batik rings in the corners */}
        <View pointerEvents="none" style={[styles.ring, { width: 260, height: 260, left: -130, top: -130 }]} />
        <View pointerEvents="none" style={[styles.ring, { width: 340, height: 340, left: -170, top: -170 }]} />
        <View pointerEvents="none" style={[styles.ring, { width: 280, height: 280, right: -140, bottom: -140, left: undefined, top: undefined }]} />
        <View pointerEvents="none" style={[styles.ring, { width: 360, height: 360, right: -180, bottom: -180, left: undefined, top: undefined }]} />

        <SafeAreaView style={styles.safe}>
          <View style={styles.top}>
            {last ? (
              <View />
            ) : (
              <Pressable onPress={onDone} hitSlop={12} accessibilityRole="button">
                <Text style={styles.skip}>{t("wSkip")}</Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.middle, { maxWidth: Math.min(width - 48, 460) }]}>
            {s.icon ? (
              <View style={[styles.iconCircle, { width: art, height: art, borderRadius: art / 2 }]}>
                <Icon name={s.icon} size={art * 0.48} color={KUNYIT} />
              </View>
            ) : (
              <Image source={LOGO} style={{ width: art, height: art }} contentFit="contain" accessibilityLabel="Waris" />
            )}
            <Text style={styles.title}>{t(s.title)}</Text>
            <Text style={styles.body}>{t(s.body)}</Text>
          </View>

          <View style={styles.bottom}>
            <View style={styles.dots}>
              {SLIDES.map((_, k) => (
                <View key={k} style={[styles.dot, k === i && styles.dotOn]} />
              ))}
            </View>
            <Pressable
              onPress={() => (last ? onDone() : setI(i + 1))}
              accessibilityRole="button"
              style={({ pressed }) => [styles.next, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.nextText}>{t(last ? "wStart" : "wNext")}</Text>
              <Icon name={last ? "check" : "arrow-forward"} size={22} color={INDIGO} />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INDIGO, overflow: "hidden" },
  ring: { position: "absolute", borderWidth: 1.5, borderColor: RING, borderRadius: 999 },
  safe: { flex: 1, paddingHorizontal: 24 },
  top: { height: 52, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
  skip: { color: "#D7DCF2", fontSize: 16, fontWeight: "600" },
  middle: { flex: 1, alignSelf: "center", alignItems: "center", justifyContent: "center", gap: 18 },
  iconCircle: { backgroundColor: "#24337A", borderWidth: 2, borderColor: KUNYIT, alignItems: "center", justifyContent: "center" },
  title: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", textAlign: "center", marginTop: 8 },
  body: { color: "#D7DCF2", fontSize: 16, lineHeight: 24, textAlign: "center" },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 24 },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#5C6FD6" },
  dotOn: { width: 24, backgroundColor: KUNYIT },
  next: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KUNYIT, paddingHorizontal: 22, height: 50, borderRadius: 25 },
  nextText: { color: INDIGO, fontSize: 16, fontWeight: "700" },
});
