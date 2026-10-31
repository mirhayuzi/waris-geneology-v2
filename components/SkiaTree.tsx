import {
  Canvas,
  Circle,
  ClipOp,
  FontWeight,
  Group,
  LinearGradient,
  PaintStyle,
  Picture,
  Rect,
  type SkCanvas,
  type SkParagraph,
  Skia,
  StrokeCap,
  type SkTypefaceFontProvider,
  TextAlign,
  useFonts,
  vec,
} from "@shopify/react-native-skia";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { TreeBackground } from "@/lib/backgrounds";
import type { Card, TreeLayout } from "@/lib/layout";
import { cardName, type Person } from "@/lib/model";
import { onTreePhotos, treePhoto } from "@/lib/skia-photos";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";
import { DECEASED_COLOR, LIVING_COLOR, lifespan } from "./TreeCard";
import type { TreeCanvasHandle } from "./TreeCanvas";

const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;
/** Fit the whole tree only if names stay readable at that size */
const FIT_MIN = 0.6;
const READABLE = 0.9;
/** Below this zoom, cards are drawn simply (big name, no photo): faster, and readable from far out */
const SIMPLE_BELOW = 0.42;
const GRID = 320;

type Colors = ReturnType<typeof useColors>;

interface Props {
  layout: TreeLayout;
  onPressCard: (card: Card) => void;
  onLongPressCard: (card: Card) => void;
  onPressFocusAdd: () => void;
  /** The "−" / "+N" button under a couple */
  onPressBranch: (card: Card) => void;
  background: TreeBackground;
}

interface Win {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  simple: boolean;
}

/**
 * The game-style tree, drawn with Skia on the GPU: one picture for the whole tree,
 * moved and zoomed on the UI thread, so panning stays smooth on big families.
 * Only the part on (or near) the screen is drawn.
 */
export const SkiaTree = forwardRef<TreeCanvasHandle, Props>(function SkiaTree({ layout, onPressCard, onLongPressCard, onPressFocusAdd, onPressBranch, background }, ref) {
  const base = useColors();
  // the chosen background brings its own line colour, picked to stand out on it
  const c = useMemo(() => ({ ...base, canvas: background.bg, line: background.line }), [base, background]);
  const { t } = useStore();
  const [view, setView] = useState({ w: 0, h: 0 });
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const s0 = useSharedValue(1);
  const x0 = useSharedValue(0);
  const y0 = useSharedValue(0);
  const f0x = useSharedValue(0);
  const f0y = useSharedValue(0);
  const fade = useSharedValue(1);
  const pulse = useSharedValue(0);
  const [win, setWin] = useState<Win | null>(null);
  const [photoTick, setPhotoTick] = useState(0);

  useEffect(() => onTreePhotos(() => setPhotoTick((n) => n + 1)), []);

  // The kunyit ring around the focus person gently breathes
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) })),
      -1,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

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
      const x = layout.width * s <= view.w ? (view.w - layout.width * s) / 2 : view.w / 2 - layout.focusX * s;
      const y = layout.height * s <= view.h ? (view.h - layout.height * s) / 2 : view.h / 2 - layout.focusY * s;
      const cfg = { duration: 420, easing: Easing.out(Easing.cubic) };
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
      tx.value = withTiming(cx - (cx - tx.value) * (s / scale.value), {
        duration: 220,
      });
      ty.value = withTiming(cy - (cy - ty.value) * (s / scale.value), {
        duration: 220,
      });
      scale.value = withTiming(s, { duration: 220 });
    },
    [view, scale, tx, ty],
  );

  useImperativeHandle(ref, () => ({ recenter, zoomBy }), [recenter, zoomBy]);

  // Jump: when someone new is tapped, the new tree starts where their card was on screen,
  // then glides so they end up in the middle
  const jumpFrom = useRef<{ sx: number; sy: number } | null>(null);
  const lastFocusKey = useRef("");
  const focusKey = `${layout.cards.find((k) => k.focus)?.person?.id}`;
  useLayoutEffect(() => {
    if (!view.w) return;
    const first = lastFocusKey.current === "";
    if (lastFocusKey.current === focusKey) return;
    lastFocusKey.current = focusKey;
    const from = jumpFrom.current;
    jumpFrom.current = null;
    if (from && !first) {
      cancelAnimation(tx);
      cancelAnimation(ty);
      tx.value = from.sx - layout.focusX * scale.value;
      ty.value = from.sy - layout.focusY * scale.value;
      fade.value = 0.25;
      fade.value = withTiming(1, { duration: 380 });
    }
    recenter(!first);
  }, [focusKey, view.w, recenter, layout, scale, tx, ty, fade]);

  // Screen size changed (rotation, tablet panel): fit again
  const lastView = useRef("");
  useEffect(() => {
    const key = `${view.w}x${view.h}`;
    if (lastView.current && lastView.current !== key && view.w) recenter(true);
    lastView.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.w, view.h]);

  // Tell the JS side which part of the tree is near the screen (in coarse steps, so it rarely redraws)
  useAnimatedReaction(
    () => {
      const s = scale.value;
      if (!view.w) return null;
      const padX = (view.w / s) * 0.5;
      const padY = (view.h / s) * 0.5;
      const left = -tx.value / s;
      const top = -ty.value / s;
      return {
        x0: Math.floor((left - padX) / GRID) * GRID,
        y0: Math.floor((top - padY) / GRID) * GRID,
        x1: Math.ceil((left + view.w / s + padX) / GRID) * GRID,
        y1: Math.ceil((top + view.h / s + padY) / GRID) * GRID,
        simple: s < SIMPLE_BELOW,
      };
    },
    (cur, prev) => {
      if (!cur) return;
      if (prev && cur.x0 === prev.x0 && cur.y0 === prev.y0 && cur.x1 === prev.x1 && cur.y1 === prev.y1 && cur.simple === prev.simple) return;
      runOnJS(setWin)(cur);
    },
    [view],
  );

  const labels = useMemo(
    () => ({
      father: t("addFather"),
      mother: t("addMother"),
      spouse: t("addSpouse"),
    }),
    [t],
  );

  // The Waris font for names on the cards (until it loads, the phone's own font is used)
  const fonts = useFonts({
    Jakarta: [
      require("@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf"),
      require("@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf"),
      require("@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf"),
    ],
  });
  if (fonts && fonts !== fontProvider) {
    fontProvider = fonts;
    paraCache.clear();
  }

  const picture = useMemo(() => {
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, layout.width, layout.height));
    if (win) drawTree(canvas, layout, win, c, labels, (p) => lifespan(p, t));
    return rec.finishRecordingAsPicture();
    // photoTick: redraw when more photos have loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, win, c, labels, t, photoTick, fonts]);

  // The background pattern stays still while the tree moves over it (drawn once per screen size)
  const pattern = useMemo(() => (background.pattern && view.w ? drawPattern(background, view.w, view.h) : null), [background, view.w, view.h]);

  const transform = useDerivedValue(() => [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }]);
  const focusCard = layout.cards.find((k) => k.focus);
  const ring = focusCard ? { x: focusCard.x + focusCard.w / 2, y: focusCard.y + 4 + 10 + 36 } : null;
  const ringR = useDerivedValue(() => 41 + pulse.value * 4);
  // the ring belongs to the detailed card; far out the simple card has its own kunyit border
  const near = useDerivedValue(() => (scale.value < SIMPLE_BELOW ? 0 : fade.value));
  const ringOpacity = useDerivedValue(() => (0.9 - pulse.value * 0.4) * near.value);
  const glowOpacity = useDerivedValue(() => 0.35 * (1 - pulse.value) * near.value);
  const glowR = useDerivedValue(() => 44 + pulse.value * 7);

  // ---------- Touch: find what is under the finger ----------
  const hit = useCallback(
    (sx: number, sy: number, s: number, ox: number, oy: number): { card: Card; part: "card" | "plus" | "branch" } | null => {
      const x = (sx - ox) / s;
      const y = (sy - oy) / s;
      const reach = Math.max(16, 14 / s);
      for (const k of layout.cards) {
        if (k.chip && Math.abs(x - k.chip.x) <= reach * 1.4 && y >= k.chip.y - 2 && y <= k.chip.y + 14 + reach) return { card: k, part: "branch" };
      }
      for (const k of layout.cards) {
        if (x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h) {
          if (k.focus && x >= k.x + k.w - 34 && y <= k.y + 34) return { card: k, part: "plus" };
          return { card: k, part: "card" };
        }
      }
      return null;
    },
    [layout],
  );

  const onTap = useCallback(
    (sx: number, sy: number, s: number, ox: number, oy: number) => {
      const h = hit(sx, sy, s, ox, oy);
      if (!h) return;
      if (h.part === "plus") return onPressFocusAdd();
      if (h.part === "branch") return onPressBranch(h.card);
      if (h.card.person && !h.card.focus)
        jumpFrom.current = {
          sx: ox + (h.card.x + h.card.w / 2) * s,
          sy: oy + (h.card.y + h.card.h / 2) * s,
        };
      onPressCard(h.card);
    },
    [hit, onPressCard, onPressFocusAdd, onPressBranch],
  );
  const onLong = useCallback(
    (sx: number, sy: number, s: number, ox: number, oy: number) => {
      const h = hit(sx, sy, s, ox, oy);
      if (h?.card.person) onLongPressCard(h.card);
    },
    [hit, onLongPressCard],
  );

  const pan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(4)
    .onStart(() => {
      cancelAnimation(tx);
      cancelAnimation(ty);
      x0.value = tx.value;
      y0.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = x0.value + e.translationX;
      ty.value = y0.value + e.translationY;
    })
    .onEnd((e) => {
      const s = scale.value;
      const minX = Math.min(view.w / 2 - layout.width * s, tx.value);
      const maxX = Math.max(view.w / 2, tx.value);
      const minY = Math.min(view.h / 2 - layout.height * s, ty.value);
      const maxY = Math.max(view.h / 2, ty.value);
      tx.value = withDecay({
        velocity: e.velocityX,
        deceleration: 0.995,
        clamp: [minX, maxX],
      });
      ty.value = withDecay({
        velocity: e.velocityY,
        deceleration: 0.995,
        clamp: [minY, maxY],
      });
    });

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(scale);
      s0.value = scale.value;
      x0.value = tx.value;
      y0.value = ty.value;
      f0x.value = e.focalX;
      f0y.value = e.focalY;
    })
    .onUpdate((e) => {
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s0.value * e.scale));
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
      tx.value = withTiming(e.x - (e.x - tx.value) * (target / scale.value), {
        duration: 240,
      });
      ty.value = withTiming(e.y - (e.y - ty.value) * (target / scale.value), {
        duration: 240,
      });
      scale.value = withTiming(target, { duration: 240 });
    });

  const tap = Gesture.Tap()
    .maxDuration(300)
    .maxDistance(12)
    .onEnd((e, ok) => {
      if (ok) runOnJS(onTap)(e.x, e.y, scale.value, tx.value, ty.value);
    });

  const longPress = Gesture.LongPress()
    .minDuration(380)
    .onStart((e) => {
      runOnJS(onLong)(e.x, e.y, scale.value, tx.value, ty.value);
    });

  const gesture = Gesture.Simultaneous(pan, pinch, Gesture.Exclusive(doubleTap, tap, longPress));

  const onLayout = (e: LayoutChangeEvent) => setView({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.fill, { backgroundColor: c.canvas }]} onLayout={onLayout} collapsable={false}>
        {view.w ? (
          <Canvas style={StyleSheet.absoluteFill}>
            {background.bg2 ? (
              <Rect x={0} y={0} width={view.w} height={view.h}>
                <LinearGradient start={vec(0, 0)} end={vec(0, view.h)} colors={[background.bg, background.bg2]} />
              </Rect>
            ) : null}
            {pattern ? <Picture picture={pattern} /> : null}
            <Group transform={transform}>
              {ring ? (
                <>
                  <Group opacity={fade}>
                    <Picture picture={picture} />
                  </Group>
                  <Circle cx={ring.x} cy={ring.y} r={glowR} color={c.focusRing} style="stroke" strokeWidth={5} opacity={glowOpacity} />
                  <Circle cx={ring.x} cy={ring.y} r={ringR} color={c.focusRing} style="stroke" strokeWidth={3} opacity={ringOpacity} />
                </>
              ) : (
                <Picture picture={picture} />
              )}
            </Group>
          </Canvas>
        ) : null}
      </View>
    </GestureDetector>
  );
});

/** Faint background pattern in screen space. */
function drawPattern(bg: TreeBackground, w: number, h: number) {
  const rec = Skia.PictureRecorder();
  const cv = rec.beginRecording(Skia.XYWHRect(0, 0, w, h));
  const color = bg.patternColor ?? bg.line;
  if (bg.pattern === "batik") {
    // clusters of rings and dots, like a batik cap print
    const ring = paint(color, { stroke: 1.4 });
    const dot = paint(color);
    const step = 150;
    for (let y = -step / 2, row = 0; y < h + step; y += step * 0.75, row++) {
      for (let x = row % 2 ? step / 2 : 0; x < w + step; x += step) {
        for (const r of [10, 20, 30]) cv.drawCircle(x, y, r, ring);
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          cv.drawCircle(x + Math.cos(a) * 40, y + Math.sin(a) * 40, 2.4, dot);
        }
      }
    }
  } else if (bg.pattern === "dots") {
    // paper: a quiet dot grid
    const dot = paint(color);
    for (let y = 12; y < h; y += 22) for (let x = 12; x < w; x += 22) cv.drawCircle(x, y, 1.3, dot);
  } else if (bg.pattern === "songket") {
    // songket: a diamond lattice with small diamonds where the threads cross
    const thread = paint(color, { stroke: 1.2 });
    const step = 56;
    for (let d = -h; d < w + h; d += step) {
      cv.drawLine(d, 0, d + h, h, thread);
      cv.drawLine(d, h, d + h, 0, thread);
    }
    const fill = paint(color);
    for (let y = 0; y < h + step; y += step / 2) {
      for (let x = (Math.round(y / (step / 2)) % 2) * (step / 2); x < w + step; x += step) {
        const p = Skia.Path.Make();
        p.moveTo(x, y - 5);
        p.lineTo(x + 5, y);
        p.lineTo(x, y + 5);
        p.lineTo(x - 5, y);
        p.close();
        cv.drawPath(p, fill);
      }
    }
  } else if (bg.pattern === "stars") {
    // night sky: soft stars, a few in kunyit gold (same sky every time)
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const star = paint(color);
    const gold = paint("#F2B92B", { alpha: 0.35 });
    const n = Math.round((w * h) / 2600);
    for (let i = 0; i < n; i++) cv.drawCircle(rnd() * w, rnd() * h, 0.8 + rnd() * 1.6, i % 11 === 0 ? gold : star);
  }
  return rec.finishRecordingAsPicture();
}

// ---------------------------------------------------------------------------
// Drawing (recorded once into a picture, replayed every frame by the GPU)
// ---------------------------------------------------------------------------

const paraCache = new Map<string, SkParagraph>();
let fontProvider: SkTypefaceFontProvider | null = null;

function para(text: string, size: number, color: string, width: number, o: { bold?: boolean; lines?: number; fit?: boolean } = {}): SkParagraph {
  const lines = o.lines ?? 1;
  const key = `${text}|${size}|${color}|${width}|${o.bold ? 1 : 0}|${lines}|${o.fit ? 1 : 0}`;
  const hitP = paraCache.get(key);
  if (hitP) return hitP;
  const make = (fs: number, limit: boolean) => {
    const b = Skia.ParagraphBuilder.Make(
      {
        textAlign: TextAlign.Center,
        ...(limit ? { maxLines: lines, ellipsis: "…" } : {}),
      },
      fontProvider ?? undefined,
    );
    b.pushStyle({
      color: Skia.Color(color),
      fontSize: fs,
      heightMultiplier: 1.15,
      fontStyle: { weight: o.bold ? FontWeight.SemiBold : FontWeight.Normal },
      ...(fontProvider ? { fontFamilies: ["Jakarta"] } : {}),
    });
    b.addText(text);
    b.pop();
    const p = b.build();
    p.layout(width);
    return p;
  };
  let p: SkParagraph | undefined;
  if (o.fit) {
    // Long names shrink a little before they are cut short
    for (const f of [1, 0.88, 0.76]) {
      const tryP = make(size * f, false);
      if (tryP.getHeight() <= size * f * 1.15 * lines + 1 && tryP.getLongestLine() <= width + 0.5) {
        p = tryP;
        break;
      }
    }
    p ??= make(size * 0.76, true);
  } else p = make(size, true);
  if (paraCache.size > 4000) paraCache.clear();
  paraCache.set(key, p);
  return p;
}

function paint(color: string, o: { stroke?: number; alpha?: number } = {}) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  if (o.alpha !== undefined) p.setAlphaf(o.alpha);
  if (o.stroke) {
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(o.stroke);
    p.setStrokeCap(StrokeCap.Round);
  }
  return p;
}

const rrect = (x: number, y: number, w: number, h: number, r: number) => Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r);

function drawTree(
  cv: SkCanvas,
  layout: TreeLayout,
  win: Win,
  c: Colors,
  labels: { father: string; mother: string; spouse: string },
  life: (p: Person) => string,
) {
  const near = (b: { x: number; y: number; w: number; h: number }) => b.x + b.w >= win.x0 && b.x <= win.x1 && b.y + b.h + 40 >= win.y0 && b.y <= win.y1;

  // Connections: one path, corners rounded into smooth curves
  const path = Skia.Path.Make();
  for (const pts of layout.curves) {
    path.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
  }
  const linePaint = paint(c.line, { stroke: win.simple ? 3 : 2 });
  const corner = Skia.PathEffect.MakeCorner(18);
  if (corner) linePaint.setPathEffect(corner);
  cv.drawPath(path, linePaint);

  // Frames (a soft shadow, then the card face)
  const shadow = paint("#000000", { alpha: 0.1 });
  const face = paint(c.surface);
  const edge = paint(c.border, { stroke: 1 });
  for (const f of layout.frames) {
    if (!near(f)) continue;
    cv.drawRRect(rrect(f.x + 0.5, f.y + 2, f.w, f.h, 8), shadow);
    cv.drawRRect(rrect(f.x, f.y, f.w, f.h, 8), face);
    cv.drawRRect(rrect(f.x, f.y, f.w, f.h, 8), edge);
  }

  for (const k of layout.cards) {
    if (!near(k)) continue;
    if (win.simple) drawSimple(cv, k, c);
    else drawCard(cv, k, c, labels, life);
    if (k.chip) drawChip(cv, k, c, win.simple);
  }
}

function drawAvatar(cv: SkCanvas, p: Person | undefined, sex: string, cx: number, cy: number, r: number, c: Colors) {
  const female = sex === "female";
  const img = p?.photo ? treePhoto(p.photo) : null;
  cv.save();
  const clip = Skia.Path.Make();
  clip.addCircle(cx, cy, r);
  cv.clipPath(clip, ClipOp.Intersect, true);
  if (img) {
    const iw = img.width();
    const ih = img.height();
    const side = Math.min(iw, ih);
    cv.drawImageRect(img, Skia.XYWHRect((iw - side) / 2, (ih - side) / 2, side, side), Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2), paint("#fff"));
  } else {
    // silhouette (also shown while the photo is still loading)
    const d = r * 2;
    const x = cx - r;
    const y = cy - r;
    cv.drawCircle(cx, cy, r, paint(female ? c.femaleSoft : c.maleSoft));
    const fg = paint(female ? c.femaleDark : c.maleDark);
    if (female) {
      const hair = paint(female ? c.femaleDark : c.maleDark, { alpha: 0.85 });
      cv.drawRRect(Skia.RRectXY(Skia.XYWHRect(x + 0.27 * d, y + 0.18 * d, 0.46 * d, 0.52 * d), 0.23 * d, 0.23 * d), hair);
      cv.drawCircle(cx, y + 0.4 * d, 0.17 * d, fg);
      cv.drawCircle(cx, y + 1.09 * d, 0.36 * d, fg);
    } else {
      cv.drawCircle(cx, y + 0.4 * d, 0.19 * d, fg);
      cv.drawCircle(cx, y + 1.08 * d, 0.38 * d, fg);
    }
  }
  cv.restore();
}

function drawLifeBadge(cv: SkCanvas, living: boolean, cx: number, cy: number, size: number, c: Colors) {
  const r = size / 2;
  cv.drawCircle(cx, cy, r, paint(c.surface));
  cv.drawCircle(cx, cy, r - 2, paint(living ? LIVING_COLOR : DECEASED_COLOR));
  if (!living) {
    // a little white flower
    const petal = paint("#ffffff");
    const pr = (r - 2) * 0.27;
    const pd = (r - 2) * 0.42;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      cv.drawCircle(cx + Math.cos(a) * pd, cy + Math.sin(a) * pd, pr, petal);
    }
    cv.drawCircle(cx, cy, pr * 0.9, paint(DECEASED_COLOR));
  }
}

function drawCard(cv: SkCanvas, k: Card, c: Colors, labels: { father: string; mother: string; spouse: string }, life: (p: Person) => string) {
  const p = k.person;
  const sex = p?.sex ?? k.add?.sex ?? "male";
  const cx = k.x + k.w / 2;
  const stripe = k.focus ? 4 : 3;
  if (p) {
    cv.drawRRect(rrect(k.x + 4, k.y, k.w - 8, stripe, stripe / 2), paint(sex === "female" ? c.female : c.male));
    if (k.focus) cv.drawRRect(rrect(k.x - 1, k.y - 1, k.w + 2, k.h + 2, 9), paint(c.focusRing, { stroke: 2.5 }));
    const a = k.focus ? 72 : 52;
    const top = k.y + stripe + (k.focus ? 10 : 8);
    const cy = top + a / 2;
    if (p.living) drawAvatar(cv, p, sex, cx, cy, a / 2, c);
    else {
      cv.saveLayer(paint("#fff", { alpha: 0.55 }));
      drawAvatar(cv, p, sex, cx, cy, a / 2, c);
      cv.restore();
    }
    const bs = k.focus ? 20 : 17;
    drawLifeBadge(cv, p.living, cx + a / 2 - bs / 2 + 2, top + a - bs / 2 + 2, bs, c);

    const [l1, l2] = cardName(p);
    const w = k.w - 12;
    const name = para(`${p.prefix && k.focus ? `${p.prefix} ` : ""}${l1}`, k.focus ? 14 : 12.5, c.text, w, { bold: k.focus, lines: 2, fit: true });
    const sub = l2 ? para(l2, 11.5, c.text, w, { fit: true }) : null;
    const dates = para(life(p), 11, p.living ? c.muted : c.text, w);
    const datesY = k.y + k.h - 6 - dates.getHeight();
    const areaTop = top + a + 4;
    const textH = name.getHeight() + (sub?.getHeight() ?? 0);
    let y = areaTop + Math.max(0, (datesY - areaTop - textH) / 2);
    name.paint(cv, k.x + 6, y);
    y += name.getHeight();
    sub?.paint(cv, k.x + 6, y);
    dates.paint(cv, k.x + 6, datesY);
    if (k.focus) {
      const px = k.x + k.w - 16;
      const py = k.y + 18;
      const plus = paint(c.muted, { stroke: 2.4 });
      cv.drawLine(px - 7, py, px + 7, py, plus);
      cv.drawLine(px, py - 7, px, py + 7, plus);
    }
  } else if (k.add) {
    const cy = k.y + 10 + 29;
    cv.drawCircle(cx, cy, 29, paint(c.addCircle));
    const plus = paint("#ffffff", { stroke: 4 });
    cv.drawLine(cx - 13, cy, cx + 13, cy, plus);
    cv.drawLine(cx, cy - 13, cx, cy + 13, plus);
    const label = para(labels[k.add.role], 12, c.text, k.w - 12, { lines: 2 });
    label.paint(cv, k.x + 6, cy + 29 + 6);
  }
}

/** Far out: a coloured block with a big first name, readable when the whole family is on screen. */
function drawSimple(cv: SkCanvas, k: Card, c: Colors) {
  const p = k.person;
  const sex = p?.sex ?? k.add?.sex ?? "male";
  const cx = k.x + k.w / 2;
  if (!p) {
    cv.drawCircle(cx, k.y + k.h / 2, 26, paint(c.addCircle, { alpha: 0.6 }));
    return;
  }
  const color = sex === "female" ? c.female : c.male;
  cv.drawRRect(rrect(k.x + 4, k.y, k.w - 8, 8, 4), paint(color));
  if (k.focus) cv.drawRRect(rrect(k.x - 2, k.y - 2, k.w + 4, k.h + 4, 10), paint(c.focusRing, { stroke: 6 }));
  cv.drawCircle(
    cx,
    k.y + 42,
    26,
    paint(sex === "female" ? c.femaleSoft : c.maleSoft, {
      alpha: p.living ? 1 : 0.5,
    }),
  );
  cv.drawCircle(cx, k.y + 42, 26, paint(p.living ? LIVING_COLOR : DECEASED_COLOR, { stroke: 4 }));
  const name = para(p.givenName, 22, c.text, k.w - 8, {
    bold: true,
    lines: 2,
    fit: true,
  });
  name.paint(cv, k.x + 4, k.y + 76);
}

/** "−" on an open branch (tap to fold it away), "+N" on a folded one or below the last generation shown. */
function drawChip(cv: SkCanvas, k: Card, c: Colors, simple: boolean) {
  const ch = k.chip!;
  const z = simple ? 2 : 1;
  const cy = ch.y + 13 * z;
  if (ch.open) {
    const r = 9 * z;
    cv.drawCircle(ch.x, cy, r, paint(c.surface));
    cv.drawCircle(ch.x, cy, r, paint(c.line, { stroke: 1.5 * z }));
    cv.drawLine(ch.x - 4 * z, cy, ch.x + 4 * z, cy, paint(c.line, { stroke: 2 * z }));
    return;
  }
  const n = k.hidden ?? k.more ?? 0;
  if (!n) return;
  const text = `+${n}`;
  const w = (14 + text.length * 7.5) * z;
  const h = 20 * z;
  const folded = k.hidden !== undefined;
  cv.drawRRect(rrect(ch.x - w / 2, cy - h / 2, w, h, h / 2), paint(folded ? c.accent : c.surfaceAlt));
  if (!folded) cv.drawRRect(rrect(ch.x - w / 2, cy - h / 2, w, h, h / 2), paint(c.border, { stroke: 1 }));
  const label = para(text, 12 * z, folded ? "#ffffff" : c.muted, w, {
    bold: true,
  });
  label.paint(cv, ch.x - w / 2, cy - label.getHeight() / 2);
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: "hidden" },
});
