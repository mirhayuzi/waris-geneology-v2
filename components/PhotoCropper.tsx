import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { cropRect } from "@/lib/crop";
import { cropSquare, type PreparedPhoto, rotatePhoto } from "@/lib/files";
import { useStore } from "@/lib/store";
import { Button, IconButton } from "./ui";

const MAX_ZOOM = 6;

/**
 * Full-screen photo adjuster, like a profile-photo cropper: drag to move, pinch to
 * zoom, rotate; the circle shows exactly what the avatar will look like.
 * Calls onDone with a square JPEG.
 */
export function PhotoCropper({ photo, onDone, onCancel }: { photo: PreparedPhoto | null; onDone: (uri: string) => void; onCancel: () => void }) {
  const { t } = useStore();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const S = Math.min(screenW - 32, screenH - 260, 380); // size of the square / circle
  const [img, setImg] = useState<PreparedPhoto | null>(photo);
  const [busy, setBusy] = useState(false);
  useEffect(() => setImg(photo), [photo]);

  // Image drawn to cover the square at zoom 1
  const base = img ? S / Math.min(img.width, img.height) : 1;
  const W = img ? img.width * base : S;
  const H = img ? img.height * base : S;

  const k = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const k0 = useSharedValue(1);
  const x0 = useSharedValue(0);
  const y0 = useSharedValue(0);

  useEffect(() => {
    k.value = 1;
    tx.value = 0;
    ty.value = 0;
  }, [img, k, tx, ty]);

  const clampX = (x: number, kk: number) => {
    "worklet";
    const m = Math.max(0, (W * kk - S) / 2);
    return Math.min(m, Math.max(-m, x));
  };
  const clampY = (y: number, kk: number) => {
    "worklet";
    const m = Math.max(0, (H * kk - S) / 2);
    return Math.min(m, Math.max(-m, y));
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      x0.value = tx.value;
      y0.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = clampX(x0.value + e.translationX, k.value);
      ty.value = clampY(y0.value + e.translationY, k.value);
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      k0.value = k.value;
    })
    .onUpdate((e) => {
      k.value = Math.min(MAX_ZOOM, Math.max(1, k0.value * e.scale));
      tx.value = clampX(tx.value, k.value);
      ty.value = clampY(ty.value, k.value);
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = k.value > 1.5 ? 1 : 2.2;
      k.value = withTiming(next);
      tx.value = withTiming(clampX(tx.value, next));
      ty.value = withTiming(clampY(ty.value, next));
    });
  const gesture = Gesture.Simultaneous(pan, pinch, doubleTap);

  const imgStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: k.value }] }));

  const done = async () => {
    if (!img || busy) return;
    setBusy(true);
    try {
      onDone(await cropSquare(img, cropRect(img, S, k.value, tx.value, ty.value)));
    } finally {
      setBusy(false);
    }
  };

  const rotate = async () => {
    if (!img || busy) return;
    setBusy(true);
    try {
      setImg(await rotatePhoto(img));
    } finally {
      setBusy(false);
    }
  };

  const RING = 600; // thick border that darkens everything outside the circle
  return (
    <Modal visible={!!photo} animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={styles.root}>
          <View style={styles.top}>
            <IconButton icon="close" label={t("cancel")} color="#fff" onPress={onCancel} />
            <Text style={styles.title}>{t("adjustPhoto")}</Text>
            <IconButton icon="rotate-right" label={t("rotate")} color="#fff" onPress={rotate} />
          </View>

          <View style={styles.middle}>
            <GestureDetector gesture={gesture}>
              <View style={{ width: S, height: S }} collapsable={false}>
                {img ? (
                  <Animated.View style={[{ position: "absolute", width: W, height: H, left: (S - W) / 2, top: (S - H) / 2 }, imgStyle]}>
                    <Image source={{ uri: img.uri }} style={{ width: W, height: H }} contentFit="fill" />
                  </Animated.View>
                ) : null}
                <View
                  pointerEvents="none"
                  style={{ position: "absolute", left: -RING, top: -RING, width: S + RING * 2, height: S + RING * 2, borderRadius: S / 2 + RING, borderWidth: RING, borderColor: "rgba(0,0,0,0.62)" }}
                />
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: S / 2, borderWidth: 2, borderColor: "rgba(255,255,255,0.9)" }]} />
              </View>
            </GestureDetector>
            <Text style={styles.hint}>{t("adjustHint")}</Text>
          </View>

          <View style={styles.bottom}>
            {busy ? <ActivityIndicator color="#fff" style={{ marginBottom: 12 }} /> : null}
            <Button title={t("usePhoto")} icon="check" onPress={done} disabled={!img || busy} />
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, height: 56, zIndex: 2, backgroundColor: "#000" },
  title: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "600", marginLeft: 8 },
  middle: { flex: 1, alignItems: "center", justifyContent: "center" },
  hint: { color: "rgba(255,255,255,0.75)", fontSize: 14, marginTop: 20, textAlign: "center", paddingHorizontal: 24, zIndex: 2 },
  bottom: { padding: 16, paddingBottom: 24, zIndex: 2, backgroundColor: "#000" },
});
