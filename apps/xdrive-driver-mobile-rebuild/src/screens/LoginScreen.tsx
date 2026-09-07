import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../auth/supabase';
import { colors, radius, shadow, spacing } from '../theme/tokens';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) setError(authError.message);
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <View style={styles.logo}><Text style={styles.logoText}>XD</Text></View>
      <Text style={styles.brand}>XDrive Driver</Text>
      <Text style={styles.subtitle}>Sign in to manage your deliveries</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} placeholder="Email address" />
        <Text style={styles.label}>Password</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder="Password" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={busy || !email || !password} onPress={signIn} style={[styles.button, (busy || !email || !password) && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.appBackground, justifyContent: 'center', padding: spacing.lg },
  logo: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: 'Inter_700Bold', fontSize: 22, color: colors.surface },
  brand: { marginTop: 14, fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.surface, textAlign: 'center' },
  subtitle: { marginTop: 6, marginBottom: 22, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#EFEFEF', textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: spacing.lg, gap: 10, ...shadow },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.small, paddingHorizontal: 12, fontFamily: 'Inter_400Regular', fontSize: 14, backgroundColor: colors.surface },
  error: { color: colors.danger, fontFamily: 'Inter_400Regular', fontSize: 12 },
  button: { marginTop: 8, minHeight: 50, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: 'Inter_700Bold', color: colors.surface, fontSize: 14 },
  disabled: { opacity: 0.5 },
});