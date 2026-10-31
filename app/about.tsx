import { Image } from "expo-image";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/Text";
import { Icon, Muted, Screen, Section } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";
import { appVersion } from "@/lib/version";
import { RELEASES } from "@/lib/whatsnew";

const LOGO = require("@/assets/images/favicon.png");

export default function AboutScreen() {
  const c = useColors();
  const { t, lang } = useStore();
  const v = appVersion();

  return (
    <Screen title={t("aboutWaris")} back>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={styles.top}>
          <Image source={LOGO} style={styles.logo} contentFit="contain" accessibilityLabel="Waris" />
          <Text style={[styles.name, { color: c.primary }]}>Waris</Text>
          <Muted>{t("tagline")}</Muted>
          <View style={[styles.version, { backgroundColor: c.surfaceAlt, borderColor: c.focusRing }]}>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>
              {t("versionLine", { v: v.version })}
              {v.build ? ` · ${t("buildN", { n: v.build })}` : ""}
              {v.date ? ` · ${v.date}` : ""}
            </Text>
          </View>
        </View>

        <View style={[styles.promise, { backgroundColor: c.primary }]}>
          <Icon name="verified-user" size={26} color={c.focusRing} />
          <Text style={{ color: c.primaryText, fontSize: 14, lineHeight: 20, flex: 1 }}>{t("privacyPromise")}</Text>
        </View>

        <Section title={t("whatsNew")}>
          {RELEASES.map((r, i) => (
            <View
              key={r.version}
              style={[styles.release, i < RELEASES.length - 1 && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
            >
              <Text style={{ color: c.text, fontSize: 15, fontWeight: "700", marginBottom: 6 }}>
                {t("versionLine", { v: r.version })}
                {r.version === v.version ? `  ·  ${t("thisVersion")}` : ""}
              </Text>
              {r.notes[lang].map((n) => (
                <View key={n} style={styles.note}>
                  <View style={[styles.dot, { backgroundColor: c.focusRing }]} />
                  <Text style={{ color: c.text, fontSize: 14, lineHeight: 20, flex: 1 }}>{n}</Text>
                </View>
              ))}
            </View>
          ))}
        </Section>

        <View style={styles.footer}>
          <View style={[styles.bar, { backgroundColor: c.focusRing }]} />
          <Muted>© 2026 Waris</Muted>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: "center", paddingTop: 12, gap: 6 },
  logo: { width: 96, height: 96, marginBottom: 6 },
  name: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  version: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  promise: { marginTop: 20, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  release: { padding: 14 },
  note: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  footer: { alignItems: "center", gap: 8, marginTop: 28 },
  bar: { width: 28, height: 3, borderRadius: 2 },
});
