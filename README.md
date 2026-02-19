# Danny Courier Ltd - Next.js Website

This is a Next.js project for Danny Courier Ltd, built with modern web technologies.

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

### Environment Variables

This project requires environment variables to be configured. Follow these steps:

1. **Copy the example file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Update the values in `.env.local`** with your actual configuration:

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g., `https://xxxxx.supabase.co`) | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous/public API key | Yes |
| `NEXT_PUBLIC_OWNER_EMAIL` | Owner account email (development only) | No |
| `NEXT_PUBLIC_OWNER_PASS` | Owner account password (development only) | No |
| `NEXT_PUBLIC_ADMIN_USER` | Admin account email (development only) | No |
| `NEXT_PUBLIC_ADMIN_PASS` | Admin account password (development only) | No |
| `NEXT_PUBLIC_MOBILE_USER` | Mobile account email (development only) | No |
| `NEXT_PUBLIC_MOBILE_PASS` | Mobile account password (development only) | No |

3. **Get your Supabase credentials:**
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Select your project
   - Navigate to Settings → API
   - Copy the Project URL and anon/public key

**⚠️ Important:** Never commit `.env.local` to version control. This file contains sensitive information and is already included in `.gitignore`.

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

## Configuration

The project uses:
- `next.config.mjs` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - ESLint configuration

## 🔑 Authentication Credentials

### Main Account (Owner)
- **Email:** dannycourierltd@gmail.com
- **Password:** Johnny2000$$
- **Access:** Full access (desktop, mobile, admin dashboard)
- **Note:** For development use only - implement proper authentication before production

### Secondary Accounts

#### Admin Desktop
- **Email:** admin@xdrivelogistics.com (or from NEXT_PUBLIC_ADMIN_USER)
- **Password:** admin123 (or from NEXT_PUBLIC_ADMIN_PASS)
- **Access:** Desktop dashboard

#### Mobile (Drivers)
- **Email:** mobile@xdrivelogistics.com (or from NEXT_PUBLIC_MOBILE_USER)
- **Password:** mobile123 (or from NEXT_PUBLIC_MOBILE_PASS)
- **Access:** Mobile interface

---

## ⚠️ Security Notice

**DEVELOPMENT ONLY:**
These credentials are hard-coded for development purposes. In production:
1. Migrate to a database-backed authentication system
2. Implement password hashing (bcrypt)
3. Add mandatory 2FA
4. Use environment variables for all credentials
5. Remove hard-coded credentials from source code

---

## Learn More

To learn more about Next.js and the technologies used in this project:

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- [Learn Next.js](https://nextjs.org/learn) - Interactive Next.js tutorial
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) - Learn about Tailwind CSS
- [Radix UI](https://www.radix-ui.com/) - Learn about accessible component primitives
