import { Image } from "expo-image";
import { memo } from "react";
import { View } from "react-native";
import { photoUri } from "@/lib/files";
import type { Person, Sex } from "@/lib/model";
import { useColors } from "@/lib/theme";

/** Round photo, or a drawn silhouette in blue (male) / pink (female). */
export const Avatar = memo(function Avatar({ person, sex, size }: { person?: Person; sex?: Sex; size: number }) {
  const c = useColors();
  const s = person?.sex ?? sex ?? "male";
  const uri = photoUri(person?.photo);
  if (uri) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: c.surfaceAlt }}>
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={120} recyclingKey={uri} />
      </View>
    );
  }
  const bg = s === "female" ? c.femaleSoft : c.maleSoft;
  const fg = s === "female" ? c.femaleDark : c.maleDark;
  // Drawn with plain views, not SVG: on Android every SVG becomes its own bitmap,
  // which adds up to a lot of memory on a big tree
  const at = (x: number, y: number, w: number, h: number, extra?: object) => ({ position: "absolute" as const, left: x * size, top: y * size, width: w * size, height: h * size, backgroundColor: fg, ...extra });
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: bg }}>
      {s === "female" ? (
        <>
          {/* long hair behind the head */}
          <View style={at(0.27, 0.18, 0.46, 0.52, { borderTopLeftRadius: 0.23 * size, borderTopRightRadius: 0.23 * size, opacity: 0.85 })} />
          <View style={at(0.33, 0.23, 0.34, 0.34, { borderRadius: 0.17 * size })} />
          <View style={at(0.14, 0.73, 0.72, 0.72, { borderRadius: 0.36 * size })} />
        </>
      ) : (
        <>
          <View style={at(0.31, 0.21, 0.38, 0.38, { borderRadius: 0.19 * size })} />
          <View style={at(0.12, 0.7, 0.76, 0.76, { borderRadius: 0.38 * size })} />
        </>
      )}
    </View>
  );
});
