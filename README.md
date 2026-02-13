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
│   ├── components/     # Reusable React components
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── mockups/            # Design mockups and integration docs
│   ├── hero/           # Hero section mockups
│   ├── services/       # Services section mockups
│   ├── about/          # About section mockups
│   ├── contact/        # Contact section mockups
│   ├── analysis/       # Mockup analysis documents
│   ├── README.md       # Complete mockup integration guide
│   └── QUICKSTART.md   # Quick reference for mockups
├── public/             # Static assets
├── netlify.toml        # Netlify configuration
├── next.config.mjs     # Next.js configuration
├── package.json        # Dependencies and scripts
└── tsconfig.json       # TypeScript configuration
```

## Design & Mockups

### Adding New Mockups

This project has a structured process for integrating design mockups:

1. **📁 Add mockup files** to the appropriate directory in `mockups/`
2. **📝 Create analysis** using the template in `mockups/analysis/TEMPLATE.md`
3. **🔍 Extract design tokens** (colors, fonts, spacing)
4. **⚡ Implement** following the documented steps

### Quick References
- **[Mockup Integration Guide](mockups/README.md)** - Complete documentation
- **[Quick Start Guide](mockups/QUICKSTART.md)** - Fast track reference
- **[Analysis Template](mockups/analysis/TEMPLATE.md)** - Structured analysis template

### Current Design Tokens
The website uses a consistent design system:
- **Primary Color**: #2563eb (Blue)
- **Secondary Color**: #10b981 (Green)
- **Typography**: System fonts with clear hierarchy
- **Spacing**: Standard 4px-based scale
- **Responsive**: Mobile-first approach

See `mockups/QUICKSTART.md` for complete design token reference.

## License

© 2021 Danny Courier LTD. All rights reserved.
