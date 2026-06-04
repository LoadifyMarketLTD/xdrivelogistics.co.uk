# XDrive Logistics Ltd - Next.js Website

This is a Next.js project for XDrive Logistics Ltd, built with modern web technologies.

## Tech Stack

- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **React Hook Form** - Performant form validation
- **Zod** - TypeScript-first schema validation

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint to check code quality
- `npm run typecheck` - Run TypeScript checks without emitting files

## Project Structure

- `/app` - Next.js App Router pages and layouts
- `/lib` - Utility functions and shared code
- `/database` - Consolidated SQL schema reference
- `/supabase/migrations` - Ordered Supabase migration history
- `/middleware.ts` - Route protection middleware
- `/public` - Static assets

## Configuration

The project uses:
- `next.config.mjs` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - ESLint configuration

## 🔑 Authentication Setup

- Use Supabase Auth users created in your own project environment.
- Do not store real credentials in repository files.
- Configure environment variables via deployment secrets and local `.env.local` only.
- Required variables are documented in `.env.example` using placeholders.
- `XDRIVE_DEFAULT_COMPANY_ID` is required for `/api/public/quote-request` so public quote submissions attach to the default company workspace.

---

## ⚠️ Security Notice

Never commit passwords, API keys, tokens, or real login pairs to source control.

---

## Quote Intake Configuration

- Set `XDRIVE_DEFAULT_COMPANY_ID` in Netlify and local `.env.local`.
- `/api/public/quote-request` inserts public requests into `public.quotes` using that company ID.
- If the variable is missing, the public quote form returns HTTP `503` by design.

## Notifications Deployment

`supabase/functions/notify-operational-event/index.ts` is ready for deployment, but it still needs Supabase dashboard wiring:

1. Deploy the Edge Function:
   ```bash
   supabase functions deploy notify-operational-event --no-verify-jwt
   ```
2. Set Supabase Edge Function secrets:
   - `SITE_URL=https://www.xdrivelogistics.co.uk`
   - `FROM_EMAIL=no-reply@xdrivelogistics.co.uk`
   - `RESEND_API_KEY=...` (optional; when omitted the queue still marks events as processed without sending email)
3. In Supabase Dashboard → Database → Webhooks, create an `INSERT` webhook on `public.notification_events` pointing to the deployed function URL.
4. Keep migration `071_notification_architecture.sql` applied so the `job_assigned`, `bid_accepted`, and `pod_uploaded` triggers continue enqueueing notification events.

The app notification bell reads directly from `public.notification_events`, so no second notification store is required.

---

## Learn More

To learn more about Next.js and the technologies used in this project:

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- [Learn Next.js](https://nextjs.org/learn) - Interactive Next.js tutorial
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) - Learn about Tailwind CSS
- [Radix UI](https://www.radix-ui.com/) - Learn about accessible component primitives
