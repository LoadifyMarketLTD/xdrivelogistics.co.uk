# XDrive Logistics Ltd - Next.js Website

This is a Next.js project for XDrive Logistics Ltd, built with modern web technologies.

## Tech Stack

- **Next.js 16** - React framework with App Router
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

## Project Structure

- `/app` - Next.js App Router pages and layouts
- `/components` - Reusable React components
- `/sections` - Page-specific sections
- `/hooks` - Custom React hooks
- `/lib` - Utility functions and shared code
- `/public` - Static assets
- `/backend` - **Deprecated legacy Express API** (not part of current production runtime)

## Backend Status

- Current production path is Next.js + Supabase (frontend direct Supabase access).
- `backend/*` is retained only for temporary legacy reference/testing.
- See `/backend/README_DEPRECATED.md` for guardrails and explicit opt-in behavior.

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

---

## ⚠️ Security Notice

Never commit passwords, API keys, tokens, or real login pairs to source control.

---

## Learn More

To learn more about Next.js and the technologies used in this project:

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- [Learn Next.js](https://nextjs.org/learn) - Interactive Next.js tutorial
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) - Learn about Tailwind CSS
- [Radix UI](https://www.radix-ui.com/) - Learn about accessible component primitives
