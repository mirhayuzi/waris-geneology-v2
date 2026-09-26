import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "tree": "account-tree",
  "wrench.fill": "build",
  "gearshape.fill": "settings",
  "person.fill": "person",
  "person.badge.plus": "person-add",
  "person.2.fill": "people",
  "plus.circle.fill": "add-circle",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "pencil": "edit",
  "trash.fill": "delete",
  "square.and.arrow.up": "share",
  "magnifyingglass": "search",
  "xmark": "close",
  "checkmark": "check",
  "heart.fill": "favorite",
  "doc.text.fill": "description",
  "chart.pie.fill": "pie-chart",
  "link": "link",
  "envelope.fill": "email",
  "camera.fill": "camera-alt",
  "photo.fill": "photo",
  "calendar": "event",
  "info.circle.fill": "info",
  "exclamationmark.triangle.fill": "warning",
  "arrow.down.doc.fill": "file-download",
  "paperplane.fill": "send",
  "clock.fill": "schedule",
  "list.bullet": "view-list",
  "arrow.up.doc.fill": "file-upload",
  "globe": "language",
  "plus": "add",
  "minus": "remove",
  "arrow.clockwise": "refresh",
  "arrow.up": "arrow-upward",
  "square.grid.2x2.fill": "grid-view",
  "folder.fill": "folder",
  "arrow.down.circle.fill": "download",
  "minus.circle.fill": "remove-circle",
  "shield.fill": "shield",
  "group.fill": "groups",
  "person.3.fill": "groups",
  "doc.on.doc.fill": "file-copy",
  "square.and.arrow.down": "save",
} as unknown as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
