import { Image } from "expo-image";
import { memo } from "react";
import { View } from "react-native";
import { photoUri } from "@/lib/files";
import type { Person } from "@/lib/model";
import { useColors } from "@/lib/theme";

/**
 * A large upright photo (not round) that fills its box, like a product picture.
 * Without a photo: a drawn silhouette in blue (male) / pink (female).
 */
export const Portrait = memo(function Portrait({ person, height, radius = 0 }: { person: Person; height: number; radius?: number }) {
  const c = useColors();
  const uri = photoUri(person.photo);
  const box = { width: "100%" as const, height, borderRadius: radius, overflow: "hidden" as const };
  if (uri) {
    return (
      <View style={[box, { backgroundColor: c.surfaceAlt }]}>
        <Image source={{ uri }} style={{ width: "100%", height }} contentFit="cover" contentPosition="top" transition={120} recyclingKey={uri} />
      </View>
    );
  }
  const female = person.sex === "female";
  const fg = female ? c.femaleDark : c.maleDark;
  const head = height * 0.32;
  return (
    <View style={[box, { backgroundColor: female ? c.femaleSoft : c.maleSoft, alignItems: "center" }]}>
      {female ? (
        <View style={{ position: "absolute", top: height * 0.2, width: head * 1.25, height: head * 1.35, borderTopLeftRadius: head, borderTopRightRadius: head, backgroundColor: fg, opacity: 0.85 }} />
      ) : null}
      <View style={{ position: "absolute", top: height * 0.24, width: head, height: head, borderRadius: head / 2, backgroundColor: fg }} />
      <View style={{ position: "absolute", top: height * 0.62, width: height * 0.78, height: height * 0.7, borderRadius: height * 0.39, backgroundColor: fg }} />
    </View>
  );
});
