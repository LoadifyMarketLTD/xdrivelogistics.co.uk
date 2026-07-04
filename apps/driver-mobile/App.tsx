import { useEffect, useState, type ComponentType } from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';

import { colors, spacing } from './src/ui/theme';

export default function App() {
  const [DriverMobileApp, setDriverMobileApp] = useState<ComponentType | null>(null);
  const [startupError, setStartupError] = useState('');

  useEffect(() => {
    let mounted = true;
    void import('./src/app/DriverMobileApp')
      .then((module) => {
        if (mounted) setDriverMobileApp(() => module.default);
      })
      .catch((error) => {
        if (mounted) setStartupError(error instanceof Error ? error.message : 'Driver app failed to start.');
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (DriverMobileApp) return <DriverMobileApp />;

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.logo}>XDrive Driver</Text>
      <Text style={styles.message}>{startupError || 'Starting driver workspace...'}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  logo: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  message: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
  },
});
