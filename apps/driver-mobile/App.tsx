import Constants from 'expo-constants';
import * as Network from 'expo-network';
import { Component, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { startDriverLocationCoordinator } from './src/tracking/locationTracking';
import { colors, spacing } from './src/ui/theme';
import { normalizeApiBaseUrl, fallbackBaseUrl as fallbackApiBaseUrl } from './src/utils/url';

type DriverMobileAppComponent = ComponentType<Record<string, never>>;

type DiagnosticSnapshot = {
  appVersion: string;
  runtime: string;
  platform: string;
  apiBaseUrl: string;
  supabaseConfigured: string;
  network: string;
};

type StartupErrorBoundaryProps = {
  children: ReactNode;
  diagnostics: DiagnosticSnapshot;
};

type StartupErrorBoundaryState = {
  errorMessage: string | null;
};

const startupTimeoutMs = 15000;

export default function App() {
  const [DriverMobileApp, setDriverMobileApp] = useState<DriverMobileAppComponent | null>(null);
  const [startupError, setStartupError] = useState('');
  const [startupMessage, setStartupMessage] = useState('Starting driver workspace...');
  const [diagnostics, setDiagnostics] = useState<DiagnosticSnapshot>({
    appVersion: 'unknown',
    runtime: 'unknown',
    platform: Platform.OS,
    apiBaseUrl: fallbackApiBaseUrl,
    supabaseConfigured: 'missing',
    network: 'unknown',
  });

  useEffect(() => {
    let mounted = true;
    let appLoaded = false;
    const stopLocationCoordinator = startDriverLocationCoordinator();
    const timeoutId = setTimeout(() => {
      if (!mounted || appLoaded) return;
      setStartupError(`Startup timeout after ${Math.floor(startupTimeoutMs / 1000)}s.`);
      setStartupMessage('Startup diagnostics available below.');
    }, startupTimeoutMs);

    void (async () => {
      setStartupMessage('Collecting startup diagnostics...');
      const snapshot = await collectDiagnostics();
      if (!mounted) return;
      setDiagnostics(snapshot);
      setStartupMessage('Loading driver workspace...');
      try {
        const module = await import('./src/app/DriverMobileApp');
        if (!mounted) return;
        appLoaded = true;
        clearTimeout(timeoutId);
        setDriverMobileApp(() => module.default as DriverMobileAppComponent);
      } catch (error) {
        if (!mounted) return;
        clearTimeout(timeoutId);
        setStartupError(formatError(error, 'Driver app failed to start.'));
        setStartupMessage('Startup diagnostics available below.');
      }
    })();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      stopLocationCoordinator();
    };
  }, []);

  if (DriverMobileApp) {
    return (
      <StartupErrorBoundary diagnostics={diagnostics}>
        <DriverMobileApp />
      </StartupErrorBoundary>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.logo}>{startupError ? 'XDrive Driver Startup Error' : 'XDrive Driver'}</Text>
      <Text style={[styles.message, startupError && styles.messageError]}>{startupError || startupMessage}</Text>
      <DiagnosticsPanel diagnostics={diagnostics} />
    </SafeAreaView>
  );
}

class StartupErrorBoundary extends Component<StartupErrorBoundaryProps, StartupErrorBoundaryState> {
  state: StartupErrorBoundaryState = { errorMessage: null };

  static getDerivedStateFromError(error: unknown): StartupErrorBoundaryState {
    return { errorMessage: formatError(error, 'Driver workspace crashed during startup.') };
  }

  render() {
    if (!this.state.errorMessage) return this.props.children;
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.logo}>XDrive Driver Runtime Error</Text>
        <Text style={[styles.message, styles.messageError]}>{this.state.errorMessage}</Text>
        <DiagnosticsPanel diagnostics={this.props.diagnostics} />
      </SafeAreaView>
    );
  }
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: DiagnosticSnapshot }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Diagnostics</Text>
      <DiagnosticRow label="App version" value={diagnostics.appVersion} />
      <DiagnosticRow label="Runtime" value={diagnostics.runtime} />
      <DiagnosticRow label="Platform" value={diagnostics.platform} />
      <DiagnosticRow label="API base" value={diagnostics.apiBaseUrl} />
      <DiagnosticRow label="Supabase config" value={diagnostics.supabaseConfigured} />
      <DiagnosticRow label="Network" value={diagnostics.network} />
    </View>
  );
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

async function collectDiagnostics(): Promise<DiagnosticSnapshot> {
  const extra = Constants.expoConfig?.extra ?? {};
  const runtime = typeof Constants.executionEnvironment === 'string' ? Constants.executionEnvironment : 'unknown';
  const appVersion = typeof Constants.expoConfig?.version === 'string' ? Constants.expoConfig.version : 'unknown';
  const apiBaseUrl = normalizeApiBaseUrl(typeof extra.apiBaseUrl === 'string' ? extra.apiBaseUrl : fallbackApiBaseUrl);
  const supabaseConfigured = hasSupabaseConfig(extra) ? 'present' : 'missing';

  let network = 'unknown';
  try {
    const state = await Network.getNetworkStateAsync();
    if (!state.isConnected) network = 'offline';
    else if (state.isInternetReachable === false) network = 'connected (no internet)';
    else network = 'online';
  } catch {
    network = 'unknown';
  }

  return {
    appVersion,
    runtime,
    platform: Platform.OS,
    apiBaseUrl,
    supabaseConfigured,
    network,
  };
}

function hasSupabaseConfig(extra: Record<string, unknown>) {
  const env = typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>) : {};
  const supabaseUrl =
    typeof extra.supabaseUrl === 'string' && extra.supabaseUrl.length > 0
      ? extra.supabaseUrl
      : (env.EXPO_PUBLIC_SUPABASE_URL ?? '');
  const supabaseAnonKey =
    typeof extra.supabaseAnonKey === 'string' && extra.supabaseAnonKey.length > 0
      ? extra.supabaseAnonKey
      : (env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '');
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function formatError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
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
  messageError: {
    color: colors.danger,
    fontWeight: '700',
  },
  panel: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: colors.panel,
    padding: spacing.md,
    gap: spacing.sm,
  },
  panelTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  row: {
    gap: spacing.xs,
  },
  rowLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  rowValue: {
    color: colors.text,
    fontSize: 14,
  },
});
