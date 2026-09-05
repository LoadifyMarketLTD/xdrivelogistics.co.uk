import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { supabase } from '../auth/supabase';
import { colors, spacing } from '../ui/theme';
import DriverMobileApp from './DriverMobileApp';

const RESET_PASSWORD_REDIRECT = 'https://www.xdrivelogistics.co.uk/reset-password';

type AuthSession = {
  access_token?: string | null;
  user?: { id?: string | null } | null;
} | null;

function hasReadySession(session: AuthSession) {
  return Boolean(session?.access_token?.trim() && session?.user?.id?.trim());
}

export default function DriverRuntimeGate() {
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }: { data: { session: AuthSession } }) => {
      if (!active) return;
      setSignedIn(hasReadySession(data.session));
      setChecking(false);
    }).catch(() => {
      if (!active) return;
      setSignedIn(false);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: unknown, session: AuthSession) => {
        if (!active) return;
        setSignedIn(hasReadySession(session));
        setChecking(false);
        if (hasReadySession(session)) setMessage('');
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) {
      setMessage('Enter both email and password.');
      return;
    }

    setWorking(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    setWorking(false);
    if (error) setMessage(error.message || 'Sign in failed.');
  }

  async function forgotPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setMessage('Enter your email address first, then choose Forgot password.');
      return;
    }

    setWorking(true);
    setMessage('');
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: RESET_PASSWORD_REDIRECT,
    });
    setWorking(false);
    if (error) {
      setMessage(error.message || 'Password reset could not be requested.');
      return;
    }

    // Keep this response account-neutral. Supabase reset requests should not be
    // used by the mobile client as an email-account existence oracle.
    setMessage('If this email belongs to an XDrive account, password reset instructions have been sent.');
  }

  if (checking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.login}>
          <Text style={styles.logo}>XDrive Driver</Text>
          <Text style={styles.subtle}>Restoring secure driver session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (signedIn) return <DriverMobileApp />;

  const hasCredentials = email.trim().length > 0 && password.trim().length > 0;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.login}>
        <Text style={styles.logo}>XDrive Driver</Text>
        <Text style={styles.subtle}>Driver operations app</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          editable={!working}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          editable={!working}
          onSubmitEditing={() => hasCredentials && !working && void signIn()}
        />
        <TouchableOpacity
          style={[styles.primaryButton, (!hasCredentials || working) && styles.disabled]}
          onPress={() => void signIn()}
          disabled={!hasCredentials || working}
        >
          <Text style={styles.primaryText}>{working ? 'Please wait...' : 'Sign in'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void forgotPassword()} disabled={working} accessibilityRole="button">
          <Text style={styles.linkText}>Forgot password?</Text>
        </TouchableOpacity>
        <Text style={styles.sessionNote}>Your secure session remains signed in on this device until you sign out or XDrive revokes the session.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  login: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  logo: { color: colors.text, fontSize: 30, fontWeight: '800' },
  subtle: { color: colors.muted },
  message: { color: colors.warning, fontWeight: '700', lineHeight: 20 },
  input: {
    minHeight: 52,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.panel,
  },
  primaryButton: {
    minHeight: 52,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryText: { color: colors.bg, fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.5 },
  linkText: { color: colors.primary, fontWeight: '800', textAlign: 'center', paddingVertical: spacing.sm },
  sessionNote: { color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
