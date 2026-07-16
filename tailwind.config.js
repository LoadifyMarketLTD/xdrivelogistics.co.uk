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
      /* ── Colour tokens — all reference CSS custom properties ── */
      colors: {
        /* Tailwind component aliases */
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-fg))",
          hover:      "hsl(var(--primary-hover))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT:          "hsl(var(--sidebar-background))",
          foreground:       "hsl(var(--sidebar-foreground))",
          primary:          "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent:           "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border:           "hsl(var(--sidebar-border))",
          ring:             "hsl(var(--sidebar-ring))",
        },
        /* ── XDrive semantic palette ── */
        surface:   "hsl(var(--surface))",
        "surface-raised": "hsl(var(--surface-raised))",
        "surface-hover":  "hsl(var(--surface-hover))",
        success: {
          DEFAULT:    "hsl(var(--success))",
          foreground: "hsl(var(--success-fg))",
        },
        warning: {
          DEFAULT:    "hsl(var(--warning))",
          foreground: "hsl(var(--warning-fg))",
        },
        danger: {
          DEFAULT:    "hsl(var(--danger))",
          foreground: "hsl(var(--danger-fg))",
        },
        info: {
          DEFAULT:    "hsl(var(--info))",
          foreground: "hsl(var(--info-fg))",
        },
      },

      /* ── Border radius — one canonical scale ── */
      borderRadius: {
        xs:  "var(--radius-sm)",    /* 4px  */
        sm:  "var(--radius-sm)",    /* 4px  */
        md:  "var(--radius-md)",    /* 8px  */
        lg:  "var(--radius-lg)",    /* 12px */
        xl:  "var(--radius-xl)",    /* 16px */
        "2xl": "var(--radius-2xl)", /* 24px */
        DEFAULT: "var(--radius)",   /* 8px  */
      },

      /* ── Box shadow / elevation ── */
      boxShadow: {
        xs:  "var(--shadow-xs)",
        sm:  "var(--shadow-sm)",
        md:  "var(--shadow-md)",
        lg:  "var(--shadow-lg)",
        nav: "var(--shadow-nav)",
      },

      /* ── Spacing scale (supplements Tailwind's default) ── */
      spacing: {
        /* 4px base grid already covered by Tailwind (1=4px, 2=8px …) */
        /* Add only where Tailwind defaults don't reach exactly */
        13: "52px",
        15: "60px",
        18: "72px",
        22: "88px",
      },

      /* ── Animations ── */
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%":      { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "caret-blink":    "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}