import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2026-05-27.dahlia',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

const PLANS: Record<string, { priceId: string; name: string }> = {
  starter:     { priceId: process.env.STRIPE_PRICE_STARTER ?? '',     name: 'XDrive Starter' },
  professional:{ priceId: process.env.STRIPE_PRICE_PROFESSIONAL ?? '', name: 'XDrive Professional' },
  enterprise:  { priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? '',   name: 'XDrive Enterprise' },
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { plan?: string; companyId?: string; email?: string };
    const { plan, companyId, email } = body;

    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    if (!companyId || !email) {
      return NextResponse.json({ error: 'companyId and email are required' }, { status: 400 });
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe is not configured on this server' }, { status: 503 });
    }

    // Resolve or create Stripe customer for this company
    const { data: sub } = await supabaseAdmin
      .from('company_subscriptions')
      .select('stripe_customer_id')
      .eq('company_id', companyId)
      .maybeSingle();

    let customerId: string | undefined = (sub as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { company_id: companyId },
      });
      customerId = customer.id;

      await supabaseAdmin.from('company_subscriptions').upsert({
        company_id: companyId,
        stripe_customer_id: customerId,
        plan,
        status: 'incomplete',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/super-admin/finance/subscriptions?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url:  `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/super-admin/finance/subscriptions?status=cancelled`,
      metadata: { company_id: companyId, plan },
      subscription_data: { metadata: { company_id: companyId, plan } },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
