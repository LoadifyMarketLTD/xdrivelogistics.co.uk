/**
 * Supabase Auth Send Email Hook.
 *
 * Replaces the default Supabase SMTP pipeline with transactional email
 * delivered through Resend.
 *
 * REQUIRED Edge Function Secrets (Supabase Dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY        — Resend API key
 *   SEND_EMAIL_HOOK_SECRET — HMAC-SHA256 secret generated in Auth → Hooks
 *
 * Deploy:
 *   supabase functions deploy send-email --no-verify-jwt
 *
 * Dashboard wiring:
 *   Auth → Hooks → Send Email → URL: <project>.supabase.co/functions/v1/send-email
 *   Generate secret in Auth hook → copy to Edge Function Secret SEND_EMAIL_HOOK_SECRET
 */

const resendApiKey = Deno.env.get('RESEND_API_KEY');
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'no-reply@xdrivelogistics.co.uk';
const siteUrl = (Deno.env.get('SITE_URL') ?? 'https://www.xdrivelogistics.co.uk').replace(/\/$/, '');

if (!resendApiKey) {
  throw new Error('[send-email] RESEND_API_KEY is not configured.');
}

if (!hookSecret) {
  throw new Error('[send-email] SEND_EMAIL_HOOK_SECRET is not configured.');
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 signature verification (Supabase signs the body with the hook secret)
// ---------------------------------------------------------------------------

async function verifyHookSignature(
  body: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return false;

  // Supabase sends: sha256=<hex>
  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return false;
  const receivedHex = signatureHeader.slice(prefix.length);

  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(hookSecret!);
  const bodyBytes = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, bodyBytes);
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (computedHex.length !== receivedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ receivedHex.charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Email subject + body builders for every Auth email type
// ---------------------------------------------------------------------------

interface AuthHookPayload {
  user: {
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function buildConfirmSignupEmail(
  name: string,
  confirmUrl: string,
): { subject: string; html: string } {
  return {
    subject: 'Confirm your XDrive Logistics account',
    html: `<h2>Welcome to XDrive Logistics</h2>
<p>Hi ${name},</p>
<p>Please confirm your email address to activate your account.</p>
<p><a href="${confirmUrl}" style="padding:10px 20px;background:#1d4ed8;color:#fff;border-radius:4px;text-decoration:none;">Confirm account</a></p>
<p>If you did not create an account, you can safely ignore this email.</p>
<p>XDrive Logistics</p>`,
  };
}

function buildMagicLinkEmail(
  name: string,
  magicUrl: string,
): { subject: string; html: string } {
  return {
    subject: 'Your XDrive Logistics sign-in link',
    html: `<h2>Sign in to XDrive Logistics</h2>
<p>Hi ${name},</p>
<p>Click the button below to sign in. This link expires in 1 hour.</p>
<p><a href="${magicUrl}" style="padding:10px 20px;background:#1d4ed8;color:#fff;border-radius:4px;text-decoration:none;">Sign in</a></p>
<p>If you did not request this, you can safely ignore this email.</p>
<p>XDrive Logistics</p>`,
  };
}

function buildPasswordRecoveryEmail(
  name: string,
  recoveryUrl: string,
): { subject: string; html: string } {
  return {
    subject: 'Reset your XDrive Logistics password',
    html: `<h2>Password reset request</h2>
<p>Hi ${name},</p>
<p>We received a request to reset your password. Click below to set a new one.</p>
<p><a href="${recoveryUrl}" style="padding:10px 20px;background:#1d4ed8;color:#fff;border-radius:4px;text-decoration:none;">Reset password</a></p>
<p>If you did not request a password reset, you can safely ignore this email.</p>
<p>XDrive Logistics</p>`,
  };
}

function buildEmailChangeEmail(
  name: string,
  changeUrl: string,
): { subject: string; html: string } {
  return {
    subject: 'Confirm your new XDrive Logistics email address',
    html: `<h2>Email address change</h2>
<p>Hi ${name},</p>
<p>Confirm your new email address by clicking the button below.</p>
<p><a href="${changeUrl}" style="padding:10px 20px;background:#1d4ed8;color:#fff;border-radius:4px;text-decoration:none;">Confirm new email</a></p>
<p>If you did not request this change, please contact support immediately.</p>
<p>XDrive Logistics</p>`,
  };
}

function buildInviteEmail(
  name: string,
  inviteUrl: string,
): { subject: string; html: string } {
  return {
    subject: 'You have been invited to XDrive Logistics',
    html: `<h2>You have been invited to XDrive Logistics</h2>
<p>Hi ${name},</p>
<p>You have been invited to join XDrive Logistics. Click below to accept and set up your account.</p>
<p><a href="${inviteUrl}" style="padding:10px 20px;background:#1d4ed8;color:#fff;border-radius:4px;text-decoration:none;">Accept invitation</a></p>
<p>If you were not expecting this invitation, you can safely ignore this email.</p>
<p>XDrive Logistics</p>`,
  };
}

// ---------------------------------------------------------------------------
// Build the action URL from token_hash (preferred) or token
// ---------------------------------------------------------------------------

function buildActionUrl(
  type: string,
  tokenHash?: string,
  token?: string,
  redirectTo?: string,
): string {
  const base = new URL(`${siteUrl}/auth/v1/verify`);

  if (tokenHash) {
    base.searchParams.set('token_hash', tokenHash);
    base.searchParams.set('type', type);
  } else if (token) {
    base.searchParams.set('token', token);
    base.searchParams.set('type', type);
  }

  if (redirectTo) {
    base.searchParams.set('redirect_to', redirectTo);
  }

  return base.toString();
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (request) => {
  console.log('[send-email] request received', request.method);

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await request.text();

  const signature = request.headers.get('x-supabase-signature');
  const valid = await verifyHookSignature(rawBody, signature);
  if (!valid) {
    console.error('[send-email] webhook signature verification failed');
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  console.log('[send-email] webhook verified');

  let payload: AuthHookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userEmail = payload?.user?.email;
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'Missing user email in payload.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const metadata = payload.user.user_metadata ?? {};
  const userName =
    String(metadata.full_name ?? metadata.name ?? userEmail.split('@')[0]);

  const emailData = payload.email_data ?? {};
  const actionType = emailData.email_action_type ?? '';
  const redirectTo = emailData.redirect_to ?? '';
  const tokenHash = emailData.token_hash ?? '';
  const token = emailData.token ?? '';

  let emailContent: { subject: string; html: string } | null = null;

  switch (actionType) {
    case 'signup':
    case 'email_change_new':
    case 'email':
    case 'confirm_signup': {
      const confirmUrl = buildActionUrl('signup', tokenHash || undefined, token || undefined, redirectTo || undefined);
      emailContent = buildConfirmSignupEmail(userName, confirmUrl);
      break;
    }
    case 'magiclink':
    case 'magic_link': {
      const magicUrl = buildActionUrl('magiclink', tokenHash || undefined, token || undefined, redirectTo || undefined);
      emailContent = buildMagicLinkEmail(userName, magicUrl);
      break;
    }
    case 'recovery': {
      const recoveryUrl = buildActionUrl('recovery', tokenHash || undefined, token || undefined, redirectTo || undefined);
      emailContent = buildPasswordRecoveryEmail(userName, recoveryUrl);
      break;
    }
    case 'email_change':
    case 'email_change_current': {
      const tokenHashNew = emailData.token_hash_new ?? '';
      const changeUrl = buildActionUrl(
        'email_change',
        tokenHashNew || tokenHash || undefined,
        token || undefined,
        redirectTo || undefined,
      );
      emailContent = buildEmailChangeEmail(userName, changeUrl);
      break;
    }
    case 'invite': {
      const inviteUrl = buildActionUrl('invite', tokenHash || undefined, token || undefined, redirectTo || undefined);
      emailContent = buildInviteEmail(userName, inviteUrl);
      break;
    }
    default: {
      console.error(`[send-email] unknown email_action_type: ${actionType}`);
      return new Response(JSON.stringify({ error: `Unsupported email action type: ${actionType}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: userEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    }),
  });

  if (!resendResponse.ok) {
    const resendError = await resendResponse.text().catch(() => '');
    console.error(`[send-email] Resend rejected: ${resendResponse.status} ${resendError.slice(0, 500)}`);
    return new Response(
      JSON.stringify({ error: 'Email delivery failed.', status: resendResponse.status }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  console.log(`[send-email] Resend send success: ${actionType} → ${userEmail}`);
  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
