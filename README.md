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
