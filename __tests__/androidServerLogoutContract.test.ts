import fs from 'node:fs';
import path from 'node:path';

describe('Android server-side logout revocation contract', () => {
  const root = process.cwd();
  const store = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/SessionStore.kt'),
    'utf8',
  );
  const revoker = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/SupabaseSessionRevoker.kt'),
    'utf8',
  );
  const viewModel = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/DriverViewModel.kt'),
    'utf8',
  );

  it('keeps the existing logout entrypoint routed through SessionStore.clear', () => {
    expect(viewModel).toContain('fun logout()');
    expect(viewModel).toContain('sessionStore.clear()');
  });

  it('revokes only the current Supabase session with the authenticated JWT', () => {
    expect(revoker).toContain('/auth/v1/logout?scope=local');
    expect(revoker).toContain('.addHeader("Authorization", "Bearer $accessToken")');
    expect(revoker).toContain('.addHeader("apikey", supabaseAnonKey)');
    expect(revoker).not.toContain('scope=global');
    expect(revoker).not.toContain('service_role');
  });

  it('removes active phone credentials immediately while retaining only encrypted retry material', () => {
    const savePending = store.indexOf('savePendingRevocation(current)');
    const clearActive = store.indexOf('clearActiveSession()', savePending);
    const retry = store.indexOf('retryPendingRevocation()', clearActive);
    expect(savePending).toBeGreaterThan(-1);
    expect(clearActive).toBeGreaterThan(savePending);
    expect(retry).toBeGreaterThan(clearActive);
    expect(store).toContain('revoker.revoke(pending)');
    expect(store).toContain('pending_logout_access_token');
    expect(store).toContain('EncryptedSharedPreferences.create');
  });

  it('retries an offline pending revocation without restoring it as an active session', () => {
    expect(store).toContain('launch { retryPendingRevocation() }');
    expect(store).toContain('retryPendingRevocation()');
    expect(store).toContain('readPendingRevocation()');
    expect(store).toContain('if (revoker.revoke(pending).isSuccess) clearPendingRevocation()');
    expect(store).toContain('clearPendingRevocation()');
    expect(store).not.toContain('.putString(Keys.accessToken, pending.accessToken)');
  });

  it('handles expired access tokens by using the refresh token only to finish revocation', () => {
    expect(revoker).toContain('LogoutResult.AUTH_EXPIRED');
    expect(revoker).toContain('/auth/v1/token?grant_type=refresh_token');
    expect(revoker).toContain('addProperty("refresh_token", refreshToken)');
    expect(revoker).toContain('logout(refreshed)');
  });
});
