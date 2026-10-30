import { Image } from "expo-image";
import { Modal, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconButton } from "./ui";

/** Full-screen photo: pinch to zoom, drag when zoomed, double-tap to zoom, swipe down to close. */
export function PhotoViewer({ uri, title, onClose }: { uri: string | null; title?: string; onClose: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const k = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const k0 = useSharedValue(1);
  const x0 = useSharedValue(0);
  const y0 = useSharedValue(0);

  const reset = () => {
    "worklet";
    k.value = withTiming(1);
    tx.value = withTiming(0);
    ty.value = withTiming(0);
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      k0.value = k.value;
    })
    .onUpdate((e) => {
      k.value = Math.min(5, Math.max(1, k0.value * e.scale));
    })
    .onEnd(() => {
      if (k.value <= 1.02) reset();
    });
  const pan = Gesture.Pan()
    .onStart(() => {
      x0.value = tx.value;
      y0.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = x0.value + e.translationX;
      ty.value = y0.value + e.translationY;
    })
    .onEnd((e) => {
      if (k.value <= 1.02) {
        // not zoomed: a swipe down closes, anything else springs back
        if (e.translationY > 120) runOnJS(onClose)();
        reset();
        return;
      }
      const mx = (W * (k.value - 1)) / 2;
      const my = (H * (k.value - 1)) / 2;
      tx.value = withTiming(Math.min(mx, Math.max(-mx, tx.value)));
      ty.value = withTiming(Math.min(my, Math.max(-my, ty.value)));
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (k.value > 1.2) reset();
      else {
        k.value = withTiming(2.5);
        tx.value = withTiming((W / 2 - e.x) * 1.5);
        ty.value = withTiming((H / 2 - e.y) * 1.5);
      }
    });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: k.value }] }));

  return (
    <Modal visible={!!uri} animationType="fade" onRequestClose={onClose} statusBarTranslucent onShow={() => reset()}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.root}>
          <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
            <Animated.View style={[StyleSheet.absoluteFill, style]} collapsable={false}>
              {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
            </Animated.View>
          </GestureDetector>
          <SafeAreaView edges={["top"]} style={styles.top} pointerEvents="box-none">
            <IconButton icon="close" label="Close" color="#fff" onPress={onClose} />
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
          </SafeAreaView>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  top: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "center", padding: 8, backgroundColor: "rgba(0,0,0,0.35)" },
  title: { color: "#fff", fontSize: 16, fontWeight: "600", marginLeft: 8, flex: 1 },
});
