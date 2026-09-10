import { StyleSheet } from 'react-native';
import { Text, View } from '../theme/primitives';

export function BrandedHeader({ title, subtitle, eyebrow = 'XDRIVE DRIVER' }: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}) {
  return <View style={styles.wrap}>
    <Text style={styles.eyebrow}>{eyebrow}</Text>
    <Text style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#0B2F6B', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20 },
  eyebrow: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.2, color: '#C3D7FF' },
  title: { marginTop: 4, fontFamily: 'Inter_700Bold', fontSize: 27, color: '#FFFFFF' },
  subtitle: { marginTop: 5, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 19, color: '#E2E8F0' },
});