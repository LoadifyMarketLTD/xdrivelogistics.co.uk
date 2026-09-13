import { StyleSheet } from 'react-native';
import { Pressable, Text } from '../theme/primitives';
import { colors } from '../theme/tokens';

export function ActionButton({
  label,
  onPress,
  outline = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  outline?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, outline ? styles.outline : styles.solid, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={[styles.text, outline && styles.outlineText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  solid: { backgroundColor: '#65C653' },
  outline: { borderWidth: 1.2, borderColor: '#65C653', backgroundColor: colors.surface },
  text: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.surface },
  outlineText: { color: '#3C8C34' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
});