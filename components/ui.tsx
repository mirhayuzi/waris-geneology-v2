import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, type TextInputProps, View, type ViewStyle } from "react-native";
import { fontFor, Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { type Colors, useColors } from "@/lib/theme";

export type IconName = ComponentProps<typeof MaterialIcons>["name"];

export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color?: string }) {
  const c = useColors();
  return <MaterialIcons name={name} size={size} color={color ?? c.text} />;
}

export function IconButton({ icon, onPress, label, color, size = 26 }: { icon: IconName; onPress: () => void; label: string; color?: string; size?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.5 }]}>
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

/** Back to the tree from anywhere, however deep. */
export function goHome() {
  if (router.canDismiss()) router.dismissTo("/");
  else router.replace("/");
}

/**
 * Screen with a simple top bar. `back` shows a back arrow plus a Home button
 * (pass `onHome` to confirm first, or `home={false}` to hide it); otherwise `left` is shown.
 */
export function Screen({
  title,
  subtitle,
  back,
  home = true,
  onHome,
  left,
  right,
  children,
  bg,
  wide,
}: {
  title: string;
  subtitle?: string;
  /** Use the full width (the tree); other screens keep a readable width on tablets */
  wide?: boolean;
  back?: boolean;
  home?: boolean;
  onHome?: () => void;
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  bg?: string;
}) {
  const c = useColors();
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: c.surface }}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        {back ? <IconButton icon="arrow-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} /> : left}
        <View style={styles.titleBox}>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: c.muted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          {back && home ? <IconButton icon="home" label="Home" onPress={onHome ?? goHome} /> : null}
          {right}
        </View>
      </View>
      <View style={{ flex: 1, backgroundColor: bg ?? c.background }}>
        <View style={wide ? { flex: 1 } : styles.readable}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

export function Button({
  title,
  onPress,
  kind = "primary",
  icon,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "danger" | "plain";
  icon?: IconName;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const c = useColors();
  const bg = kind === "primary" ? c.primary : kind === "danger" ? "transparent" : kind === "plain" ? "transparent" : c.surface;
  const fg = kind === "primary" ? c.primaryText : kind === "danger" ? c.danger : kind === "plain" ? c.primary : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: kind === "secondary" ? c.border : kind === "danger" ? c.danger : "transparent", opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Section({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ marginTop: 18 }}>
      {title ? (
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: c.muted }]}>{title}</Text>
          {right}
        </View>
      ) : null}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{children}</View>
    </View>
  );
}

export function Row({
  title,
  subtitle,
  left,
  right,
  onPress,
  onLongPress,
  last,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  last?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }, pressed && { backgroundColor: c.surfaceAlt }]}
    >
      {left}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: c.muted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={22} color={c.muted} /> : null)}
    </Pressable>
  );
}

export function Field({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.muted}
        {...props}
        style={[styles.input, { fontFamily: fontFor(), color: c.text, borderColor: error ? c.danger : c.border, backgroundColor: c.surface }, props.multiline && { minHeight: 80, textAlignVertical: "top" }]}
      />
      {error ? <Text style={[styles.hint, { color: c.danger }]}>{error}</Text> : hint ? <Text style={[styles.hint, { color: c.muted }]}>{hint}</Text> : null}
    </View>
  );
}

/** Pick one option from a short list. */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  allowNone,
}: {
  label?: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T | undefined) => void;
  allowNone?: boolean;
}) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={[styles.label, { color: c.muted }]}>{label}</Text> : null}
      <View style={styles.chips}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(on && allowNone ? undefined : o.value)}
              style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : c.surface }]}
            >
              <Text style={{ color: on ? c.primaryText : c.text, fontSize: 14 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  const c = useColors();
  return <Text style={[{ color: c.muted, fontSize: 13, lineHeight: 18 }, style]}>{children}</Text>;
}

export const sheetStyle = (c: Colors) => ({
  width: "100%" as const,
  maxWidth: 640,
  alignSelf: "center" as const,
  backgroundColor: c.surface,
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
  padding: 18,
  paddingBottom: 34,
});

const styles = StyleSheet.create({
  readable: { flex: 1, width: "100%", maxWidth: 760, alignSelf: "center" },
  header: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  titleBox: { flex: 1, marginLeft: 8 },
  title: { fontSize: 20, fontWeight: "600" },
  subtitle: { fontSize: 12, marginTop: -1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: { padding: 8 },
  button: { height: 48, borderRadius: 12, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12, minHeight: 56 },
  rowTitle: { fontSize: 16 },
  rowSub: { fontSize: 13, marginTop: 2 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  hint: { fontSize: 12, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
});
