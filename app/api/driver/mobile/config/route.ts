import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

function isValidSupabaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('supabase.co');
  } catch {
    return false;
  }
}

function isValidSupabaseAnonKey(value: string) {
  return value.length > 0 && value !== 'placeholder' && value !== 'placeholder-anon-key';
}

export async function GET() {
  if (!isValidSupabaseUrl(supabaseUrl) || !isValidSupabaseAnonKey(supabaseAnonKey)) {
    return NextResponse.json({ error: 'Mobile auth config is unavailable.' }, { status: 503 });
  }

  return NextResponse.json({
    supabaseUrl,
    supabaseAnonKey,
  });
}
