import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /* ── Existing Tailwind/shadcn tokens (do not remove) ──────────── */
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        /* ── XDrive Visual System colours (marketing homepage) ───────── */
        xd: {
          'bg-primary':   'var(--xd-bg-primary)',
          'bg-secondary': 'var(--xd-bg-secondary)',
          'bg-tertiary':  'var(--xd-bg-tertiary)',
          'surface-light': 'var(--xd-surface-light)',
          'surface-white': 'var(--xd-surface-white)',
          'border-dark':  'var(--xd-border-dark)',
          'border-light': 'var(--xd-border-light)',
          'blue':         'var(--xd-blue)',
          'blue-hover':   'var(--xd-blue-hover)',
          'blue-soft':    'var(--xd-blue-soft)',
          'text-dp':      'var(--xd-text-dark-primary)',
          'text-ds':      'var(--xd-text-dark-secondary)',
          'text-lp':      'var(--xd-text-light-primary)',
          'text-ls':      'var(--xd-text-light-secondary)',
          'success':      'var(--xd-success)',
          'warning':      'var(--xd-warning)',
          'danger':       'var(--xd-danger)',
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
        /* XDrive Visual System radii */
        'xd-sm':  'var(--xd-radius-sm)',
        'xd-md':  'var(--xd-radius-md)',
        'xd-lg':  'var(--xd-radius-lg)',
        'xd-xl':  'var(--xd-radius-xl)',
        'xd-2xl': 'var(--xd-radius-2xl)',
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        /* XDrive Visual System shadows */
        'xd-card':       'var(--xd-shadow-card)',
        'xd-card-hover': 'var(--xd-shadow-card-hover)',
        'xd-screenshot': 'var(--xd-shadow-screenshot)',
        'xd-glow-blue':  'var(--xd-shadow-glow-blue)',
      },
      fontFamily: {
        xd: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        /* XDrive heading scale */
        'xd-h1': ['var(--xd-h1-size)', { lineHeight: 'var(--xd-h1-line)', fontWeight: 'var(--xd-h1-weight)' }],
        'xd-h2': ['var(--xd-h2-size)', { lineHeight: 'var(--xd-h2-line)', fontWeight: 'var(--xd-h2-weight)' }],
        'xd-h3': ['var(--xd-h3-size)', { lineHeight: 'var(--xd-h3-line)', fontWeight: 'var(--xd-h3-weight)' }],
        'xd-h4': ['var(--xd-h4-size)', { lineHeight: 'var(--xd-h4-line)', fontWeight: 'var(--xd-h4-weight)' }],
        'xd-h5': ['var(--xd-h5-size)', { lineHeight: 'var(--xd-h5-line)', fontWeight: 'var(--xd-h5-weight)' }],
        'xd-body-l': ['var(--xd-body-l-size)', { lineHeight: 'var(--xd-body-l-line)' }],
        'xd-body-m': ['var(--xd-body-m-size)', { lineHeight: 'var(--xd-body-m-line)' }],
        'xd-body-s': ['var(--xd-body-s-size)', { lineHeight: 'var(--xd-body-s-line)' }],
        'xd-caption': ['var(--xd-caption-size)', { lineHeight: 'var(--xd-caption-line)', fontWeight: 'var(--xd-caption-weight)' }],
        'xd-btn':     ['var(--xd-btn-size)',     { lineHeight: 'var(--xd-btn-line)',     fontWeight: 'var(--xd-btn-weight)' }],
        'xd-label':   ['var(--xd-label-size)',   { lineHeight: 'var(--xd-label-line)',   fontWeight: 'var(--xd-label-weight)', letterSpacing: 'var(--xd-label-tracking)' }],
      },
      spacing: {
        /* XDrive spacing scale */
        'xd-1':  'var(--xd-sp-1)',
        'xd-2':  'var(--xd-sp-2)',
        'xd-3':  'var(--xd-sp-3)',
        'xd-4':  'var(--xd-sp-4)',
        'xd-6':  'var(--xd-sp-6)',
        'xd-8':  'var(--xd-sp-8)',
        'xd-12': 'var(--xd-sp-12)',
        'xd-16': 'var(--xd-sp-16)',
        'xd-20': 'var(--xd-sp-20)',
        'xd-24': 'var(--xd-sp-24)',
        'xd-30': 'var(--xd-sp-30)',
        'xd-40': 'var(--xd-sp-40)',
      },
      maxWidth: {
        'xd-container': 'var(--xd-container-max)',
        'xd-content':   'var(--xd-container-safe)',
        'xd-prose':     'var(--xd-prose-width)',
      },
      transitionDuration: {
        'xd-fast': 'var(--xd-dur-fast)',
        'xd-base': 'var(--xd-dur-base)',
        'xd-slow': 'var(--xd-dur-slow)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        /* XDrive motion */
        "xd-fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "xd-slide-up": {
          from: { opacity: "0", transform: "translateY(var(--xd-slide-md))" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        /* XDrive animations */
        "xd-fade-in":  "xd-fade-in var(--xd-dur-base) var(--xd-ease-out) both",
        "xd-slide-up": "xd-slide-up var(--xd-dur-slow) var(--xd-ease-out) both",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}