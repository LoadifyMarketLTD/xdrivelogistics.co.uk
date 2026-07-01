import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { loadSession, isSessionExpired } from '../src/auth/session';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useState } from 'react';

export default function Index() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    loadSession().then((session) => {
      if (session && !isSessionExpired(session)) {
        setAuthenticated(true);
      }
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return authenticated ? (
    <Redirect href="/(app)/active-job" />
  ) : (
    <Redirect href="/(auth)/login" />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
});
