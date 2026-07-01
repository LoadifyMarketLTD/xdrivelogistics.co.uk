import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Point = {
  x: number;
  y: number;
};

type Stroke = Point[];

function toPath(stroke: Stroke): string {
  if (stroke.length === 0) return '';
  const [start, ...rest] = stroke;
  return [`M ${start.x} ${start.y}`, ...rest.map((point) => `L ${point.x} ${point.y}`)].join(' ');
}

function toSvg(strokes: Stroke[], width: number, height: number): string | null {
  if (!strokes.length || !width || !height) return null;
  const paths = strokes
    .filter((stroke) => stroke.length > 0)
    .map(
      (stroke) =>
        `<path d="${toPath(stroke)}" stroke="#f8fafc" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" />`
    )
    .join('');

  if (!paths) return null;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#0f172a" />${paths}</svg>`;
}

export function SignaturePad({
  onChange,
}: {
  onChange: (payload: { svg: string | null; hasSignature: boolean }) => void;
}) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const currentStrokeRef = useRef<Stroke>([]);

  const allStrokes = useMemo(
    () => (currentStroke.length ? [...strokes, currentStroke] : strokes),
    [currentStroke, strokes]
  );

  useEffect(() => {
    const svg = toSvg(strokes, size.width, size.height);
    onChange({ svg, hasSignature: strokes.length > 0 });
  }, [onChange, size.height, size.width, strokes]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          const nextStroke = [{ x: locationX, y: locationY }];
          currentStrokeRef.current = nextStroke;
          setCurrentStroke(nextStroke);
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          currentStrokeRef.current = [
            ...currentStrokeRef.current,
            { x: locationX, y: locationY },
          ];
          setCurrentStroke(currentStrokeRef.current);
        },
        onPanResponderRelease: () => {
          setStrokes((existing) =>
            currentStrokeRef.current.length > 0
              ? [...existing, currentStrokeRef.current]
              : existing
          );
          currentStrokeRef.current = [];
          setCurrentStroke([]);
        },
        onPanResponderTerminate: () => {
          currentStrokeRef.current = [];
          setCurrentStroke([]);
        },
      }),
    []
  );

  return (
    <View style={styles.wrapper}>
      <View
        style={styles.canvas}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setSize({ width: Math.round(width), height: Math.round(height) });
        }}
        {...panResponder.panHandlers}
      >
        <Svg width="100%" height="100%">
          {allStrokes.map((stroke, index) => (
            <Path
              key={`${index}-${stroke.length}`}
              d={toPath(stroke)}
              stroke="#f8fafc"
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
        {!allStrokes.length ? (
          <Text style={styles.placeholder}>Sign here with your finger or stylus</Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Text style={styles.helper}>Signature is saved locally until POD upload.</Text>
        <TouchableOpacity
          style={[styles.clearButton, !allStrokes.length && styles.clearButtonDisabled]}
          onPress={() => {
            currentStrokeRef.current = [];
            setStrokes([]);
            setCurrentStroke([]);
            onChange({ svg: null, hasSignature: false });
          }}
          disabled={!allStrokes.length}
        >
          <Text style={styles.clearButtonText}>Clear signature</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
    marginBottom: 24,
  },
  canvas: {
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#020617',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    position: 'absolute',
    color: '#64748b',
    fontSize: 13,
  },
  actions: {
    gap: 8,
  },
  helper: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  clearButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#1e293b',
  },
  clearButtonDisabled: {
    opacity: 0.4,
  },
  clearButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
});
