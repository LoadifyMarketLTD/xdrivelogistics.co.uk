import { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { colors, spacing } from './theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAD_HEIGHT = 180;
const STROKE_COLOR = '#2f6df6';
const STROKE_WIDTH = 2.5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Point = { x: number; y: number };

function pointsToPathD(points: Point[]): string {
  if (points.length === 0) return '';
  const first = points[0];
  if (points.length === 1) {
    // Render a tiny visible dot for a single tap
    return `M ${first.x.toFixed(1)} ${first.y.toFixed(1)} L ${(first.x + 0.5).toFixed(1)} ${first.y.toFixed(1)}`;
  }
  let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${(points[i] as Point).x.toFixed(1)} ${(points[i] as Point).y.toFixed(1)}`;
  }
  return d;
}

function buildSvgDataUrl(paths: string[], width: number): string {
  const pathEls = paths
    .map(
      (d) =>
        `<path d="${d}" stroke="${STROKE_COLOR}" stroke-width="${STROKE_WIDTH}" ` +
        `fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    )
    .join('');
  // All content is ASCII (numbers + hex colors + path commands) so btoa is safe
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${PAD_HEIGHT}" ` +
    `viewBox="0 0 ${width} ${PAD_HEIGHT}">${pathEls}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ─── SignaturePad ─────────────────────────────────────────────────────────────

/**
 * A native signature-capture pad backed by PanResponder + react-native-svg.
 *
 * `onCapture` is called after every stroke with the current signature encoded
 * as a `data:image/svg+xml;base64,…` data URL, or `null` when cleared.
 */
export function SignaturePad({ onCapture }: { onCapture: (dataUrl: string | null) => void }) {
  // Use refs for mutable drawing state so the PanResponder is created once
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  const padWidthRef = useRef(300);
  const currentPointsRef = useRef<Point[]>([]);
  const completedPathsRef = useRef<string[]>([]);

  // Render state (derived from refs when a stroke completes)
  const [renderedPaths, setRenderedPaths] = useState<string[]>([]);
  const [currentPathD, setCurrentPathD] = useState('');

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    padWidthRef.current = e.nativeEvent.layout.width;
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim touch in capture phase so the parent ScrollView cannot steal it
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,

        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          currentPointsRef.current = [{ x: locationX, y: locationY }];
          setCurrentPathD(pointsToPathD(currentPointsRef.current));
        },

        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          currentPointsRef.current.push({ x: locationX, y: locationY });
          setCurrentPathD(pointsToPathD(currentPointsRef.current));
        },

        onPanResponderRelease: () => {
          flushCurrentStroke();
        },

        onPanResponderTerminate: () => {
          flushCurrentStroke();
        },
      }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function flushCurrentStroke() {
    if (currentPointsRef.current.length === 0) return;
    const pathD = pointsToPathD(currentPointsRef.current);
    completedPathsRef.current = [...completedPathsRef.current, pathD];
    currentPointsRef.current = [];
    setRenderedPaths([...completedPathsRef.current]);
    setCurrentPathD('');
    onCaptureRef.current(buildSvgDataUrl(completedPathsRef.current, padWidthRef.current));
  }

  const handleClear = useCallback(() => {
    completedPathsRef.current = [];
    currentPointsRef.current = [];
    setRenderedPaths([]);
    setCurrentPathD('');
    onCaptureRef.current(null);
  }, []);

  const hasSignature = renderedPaths.length > 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Signature</Text>
        {hasSignature && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn} accessibilityLabel="Clear signature">
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <View
        style={styles.pad}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
        collapsable={false}
        accessibilityLabel="Signature pad – draw your signature here"
      >
        <Svg width="100%" height={PAD_HEIGHT}>
          {renderedPaths.map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke={STROKE_COLOR}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentPathD ? (
            <Path
              d={currentPathD}
              stroke={STROKE_COLOR}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>

        {!hasSignature && !currentPathD && (
          <View style={styles.placeholder} pointerEvents="none">
            <Text style={styles.placeholderText}>Sign here</Text>
          </View>
        )}
      </View>

      {hasSignature && <Text style={styles.captured}>✓ Signature captured</Text>}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  clearBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  clearText: {
    color: colors.text,
    fontSize: 13,
  },
  pad: {
    height: PAD_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
    overflow: 'hidden',
    position: 'relative',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: colors.muted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  captured: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
});
