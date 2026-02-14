# XDrive Logistics Website

This is the official website for XDrive Logistics Ltd, built with Next.js 16 and deployed on Netlify.

## Technology Stack

- **Framework**: Next.js 16.1.6
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
│   ├── config/         # Configuration files
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

## Design System

### Current Design Tokens (XDrive Logistics Premium Dark Theme)
The website uses a professional premium dark theme:
- **Primary Navy Dark**: #0A2239 (Background, Header, Footer)
- **Primary Navy**: #1F3A5F (Sections, Cards)
- **Gold Primary**: #D4AF37 (Accents, CTAs, Logo)
- **Gold Dark**: #B8941F (Hover states)
- **Green Primary**: #1F7A3D (Checkmarks, Success)
- **WhatsApp Green**: #25D366 (WhatsApp buttons)
- **Background Light**: #F4F7FA (Light sections)
- **Typography**: Inter font family
- **Spacing**: Consistent 24px, 32px, 48px, 64px scale
- **Responsive**: Mobile-first with breakpoints at 768px and 1024px

### Key Features
- Premium dark theme with cinematic aesthetics
- Glass morphism effects on cards and modals
- Smooth animations (0.3s transitions)
- Fully responsive design (mobile, tablet, desktop)
- Interactive quote modal
- WhatsApp integration
- SEO optimized

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

## License

© 2026 XDrive Logistics Ltd. All rights reserved.
