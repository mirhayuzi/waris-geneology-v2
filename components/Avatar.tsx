import { Image } from "expo-image";
import { memo } from "react";
import { View } from "react-native";
import Svg, { Circle, ClipPath, Defs, Path } from "react-native-svg";
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
  const id = `clip-${size}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id={id}>
          <Circle cx="50" cy="50" r="50" />
        </ClipPath>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill={bg} />
      {s === "female" ? (
        <>
          {/* long hair behind the head and shoulders */}
          <Path d="M50 17c-15 0-24 10-24 25 0 12-4 20-7 28h62c-3-8-7-16-7-28 0-15-9-25-24-25z" fill={fg} opacity={0.85} />
          <Circle cx="50" cy="40" r="17" fill={fg} />
          <Path d="M14 104c2-20 18-31 36-31s34 11 36 31z" fill={fg} clipPath={`url(#${id})`} />
        </>
      ) : (
        <>
          <Circle cx="50" cy="40" r="19" fill={fg} />
          <Path d="M12 104c2-22 18-34 38-34s36 12 38 34z" fill={fg} clipPath={`url(#${id})`} />
        </>
      )}
    </Svg>
  );
});
