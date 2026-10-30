import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withDecay, withTiming } from "react-native-reanimated";
import { type Card, lineBars, type TreeLayout } from "@/lib/layout";
import { useColors } from "@/lib/theme";
import { TreeCard } from "./TreeCard";

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
/** Fit the whole tree only if names stay readable at that size */
const FIT_MIN = 0.6;
const READABLE = 0.9;

export interface TreeCanvasHandle {
  /** Fit the tree on screen, centred on the focus person. */
  recenter: (animated?: boolean) => void;
  zoomBy: (factor: number) => void;
}

interface Props {
  layout: TreeLayout;
  onPressCard: (card: Card) => void;
  onLongPressCard: (card: Card) => void;
  onPressFocusAdd: () => void;
  /** Background colour and line colour of the chosen template (patterns are drawn by the game-style tree only) */
  background?: { bg: string; line: string };
}

/**
 * Pan (one finger) and pinch-zoom (two fingers) canvas. Double-tap zooms in,
 * double-tap again when zoomed in fits the tree back on screen.
 */
export const TreeCanvas = forwardRef<TreeCanvasHandle, Props>(function TreeCanvas({ layout, onPressCard, onLongPressCard, onPressFocusAdd, background }, ref) {
  const base = useColors();
  const c = useMemo(() => (background ? { ...base, canvas: background.bg, line: background.line } : base), [base, background]);
  const [view, setView] = useState({ w: 0, h: 0 });
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const s0 = useSharedValue(1);
  const x0 = useSharedValue(0);
  const y0 = useSharedValue(0);
  const f0x = useSharedValue(0);
  const f0y = useSharedValue(0);

  const fitScale = useCallback(() => {
    if (!view.w || !view.h) return 1;
    const s = Math.min(view.w / layout.width, view.h / layout.height, 1);
    // A small family fits whole on screen. A big one would shrink to unreadable dots, so
    // start at a readable size around the centre person instead (pinch out for the overview)
    return s >= FIT_MIN ? s : READABLE;
  }, [view, layout.width, layout.height]);

  const recenter = useCallback(
    (animated = true) => {
      if (!view.w) return;
      const s = fitScale();
      // Centre the whole tree when it fits on screen; otherwise centre on the focus person
      const x = layout.width * s <= view.w ? (view.w - layout.width * s) / 2 : view.w / 2 - layout.focusX * s;
      const y = layout.height * s <= view.h ? (view.h - layout.height * s) / 2 : view.h / 2 - layout.focusY * s;
      const cfg = { duration: 280 };
      scale.value = animated ? withTiming(s, cfg) : s;
      tx.value = animated ? withTiming(x, cfg) : x;
      ty.value = animated ? withTiming(y, cfg) : y;
    },
    [view, layout, fitScale, scale, tx, ty],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value * factor));
      const cx = view.w / 2;
      const cy = view.h / 2;
      tx.value = withTiming(cx - (cx - tx.value) * (s / scale.value), { duration: 200 });
      ty.value = withTiming(cy - (cy - ty.value) * (s / scale.value), { duration: 200 });
      scale.value = withTiming(s, { duration: 200 });
    },
    [view, scale, tx, ty],
  );

  useImperativeHandle(ref, () => ({ recenter, zoomBy }), [recenter, zoomBy]);

  // Re-centre whenever the tree changes focus (or first appears)
  const lastFocusKey = useRef<string>("");
  const focusKey = `${layout.cards.find((k) => k.focus)?.person?.id}`;
  useEffect(() => {
    if (!view.w) return;
    const first = lastFocusKey.current === "";
    if (lastFocusKey.current !== focusKey) {
      lastFocusKey.current = focusKey;
      recenter(!first);
    }
  }, [focusKey, view.w, recenter]);

  const pan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(4)
    .onStart(() => {
      x0.value = tx.value;
      y0.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = x0.value + e.translationX;
      ty.value = y0.value + e.translationY;
    })
    .onEnd((e) => {
      // Glide after a flick, but never so far that the tree leaves the screen
      const s = scale.value;
      const minX = Math.min(view.w / 2 - layout.width * s, tx.value);
      const maxX = Math.max(view.w / 2, tx.value);
      const minY = Math.min(view.h / 2 - layout.height * s, ty.value);
      const maxY = Math.max(view.h / 2, ty.value);
      tx.value = withDecay({ velocity: e.velocityX, deceleration: 0.994, clamp: [minX, maxX] });
      ty.value = withDecay({ velocity: e.velocityY, deceleration: 0.994, clamp: [minY, maxY] });
    });

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      s0.value = scale.value;
      x0.value = tx.value;
      y0.value = ty.value;
      f0x.value = e.focalX;
      f0y.value = e.focalY;
    })
    .onUpdate((e) => {
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s0.value * e.scale));
      // keep the point under the fingers in place (and follow the fingers as they move)
      tx.value = e.focalX - (f0x.value - x0.value) * (s / s0.value);
      ty.value = e.focalY - (f0y.value - y0.value) * (s / s0.value);
      scale.value = s;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((e, ok) => {
      if (!ok) return;
      const target = scale.value < 0.95 ? Math.min(scale.value * 1.8, 1.2) : Math.min(scale.value * 1.6, MAX_SCALE);
      tx.value = withTiming(e.x - (e.x - tx.value) * (target / scale.value), { duration: 220 });
      ty.value = withTiming(e.y - (e.y - ty.value) * (target / scale.value), { duration: 220 });
      scale.value = withTiming(target, { duration: 220 });
    });

  const gesture = Gesture.Simultaneous(pan, pinch, doubleTap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  // Connector lines as thin views: memory stays small however wide the tree is
  const bars = useMemo(() => layout.lines.flatMap((l) => lineBars(l, 1.6).map((b, i) => ({ ...b, key: `${l.key}-${i}` }))), [layout.lines]);

  const onLayout = (e: LayoutChangeEvent) => setView({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.fill, { backgroundColor: c.canvas }]} onLayout={onLayout} collapsable={false}>
        <Animated.View style={[{ width: layout.width, height: layout.height, transformOrigin: "left top" }, style]}>
          {bars.map((b) => (
            <View key={b.key} pointerEvents="none" style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, backgroundColor: c.line }} />
          ))}
          {layout.frames.map((f) => (
            <View
              key={f.key}
              pointerEvents="none"
              style={[styles.frame, { left: f.x, top: f.y, width: f.w, height: f.h, backgroundColor: c.surface, borderColor: c.border }]}
            />
          ))}
          {layout.cards.map((card) => (
            <TreeCard key={card.key} card={card} onPress={onPressCard} onLongPress={onLongPressCard} onPressAdd={onPressFocusAdd} />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: "hidden" },
  frame: {
    position: "absolute",
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
