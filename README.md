# Danny Courier LTD Website

This is the official website for Danny Courier LTD, built with Next.js 14 and deployed on Netlify.

## Technology Stack

- **Framework**: Next.js 14.2.5
- **Runtime**: Node.js 20
- **Deployment**: Netlify with Next.js plugin

## Development

### Prerequisites

- Node.js 20 (specified in `.nvmrc`)
- npm

### Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## Deployment

### Netlify Configuration

The site is configured to deploy from the `main` branch. Deployment settings are defined in `netlify.toml`:

- **Build Command**: `npm run build`
- **Node Version**: 20
- **Plugin**: `@netlify/plugin-nextjs`

The Netlify Next.js plugin automatically handles the publish directory and serverless functions configuration.

### Branch Configuration

- **Production Branch**: `main`
- **Default Branch**: `main`

All pull requests create deploy previews automatically.

## Project Structure

```
.
├── app/                 # Next.js App Router
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── netlify.toml        # Netlify configuration
├── next.config.mjs     # Next.js configuration
├── package.json        # Dependencies and scripts
└── tsconfig.json       # TypeScript configuration
```

## License

© 2026 Danny Courier LTD. All rights reserved.
