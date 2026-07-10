export const config = {
  xdriveBaseUrl: process.env.EXPO_PUBLIC_XDRIVE_BASE_URL ?? "http://127.0.0.1:3005",
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

export function assertRuntimeConfig() {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  }
}
