// Premium Dark + Gold Theme Configuration
// Danny Courier Brand Colors - Exact specification from requirements

export const THEME = {
  // Color Palette - Danny Courier Brand Colors (EXACT SPEC)
  colors: {
    // Primary - Navy
    primary: {
      dark: '#0A2239',      // Navy dark (EXACT) - Header, Footer, Main background
      navy: '#1F3A5F',      // Navy Primary (EXACT) - Services, CTA sections
      slate: '#2D3748',     // Medium dark
    },
    
    // Accent - Premium Gold
    gold: {
      primary: '#D4AF37',   // Gold accent (EXACT) - Logo X, highlights
      light: '#E5C158',     // Light gold
      dark: '#B8941F',      // Dark gold (EXACT) - hover state
    },
    
    // CTA Green
    green: {
      primary: '#1F7A3D',   // Green CTA (EXACT) - Checkmarks
      dark: '#1B5E20',      // Dark green (hover)
      light: '#4CAF50',     // Light green
      whatsapp: '#25D366',  // WhatsApp green (EXACT)
      whatsappHover: '#20ba5a', // WhatsApp hover
    },
    
    // Text Colors
    text: {
      primary: '#FFFFFF',   // White text (EXACT)
      secondary: 'rgba(255,255,255,0.85)', // White transparent (EXACT)
      muted: '#94A3B8',     // Muted gray
      dark: '#0A2239',      // Dark text (EXACT) - for light backgrounds
    },
    
    // Background Colors
    background: {
      light: '#F4F7FA',     // Light Background (EXACT)
      dark: '#0A2239',      // Dark background (EXACT)
    },
    
    // Glass Effects
    glass: {
      light: 'rgba(255, 255, 255, 0.1)',
      medium: 'rgba(255, 255, 255, 0.15)',
      dark: 'rgba(0, 0, 0, 0.3)',
    },
    
    // Borders
    border: {
      light: 'rgba(255, 255, 255, 0.2)',
      gold: 'rgba(212, 175, 55, 0.3)',
    },
    
    // Semantic Colors
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  
  // Typography
  typography: {
    fonts: {
      display: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      body: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    
    sizes: {
      hero: {
        desktop: '64px',
        tablet: '48px',
        mobile: '36px',
      },
      h1: {
        desktop: '48px',
        tablet: '40px',
        mobile: '32px',
      },
      h2: {
        desktop: '40px',
        tablet: '32px',
        mobile: '28px',
      },
      h3: {
        desktop: '32px',
        tablet: '28px',
        mobile: '24px',
      },
      body: {
        large: '20px',
        regular: '16px',
        small: '14px',
      },
    },
    
    weights: {
      bold: 700,
      semibold: 600,
      medium: 500,
      regular: 400,
    },
  },
  
  // Spacing
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
    '4xl': '96px',
  },
  
  // Border Radius
  borderRadius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  
  // Shadows
  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.1)',
    md: '0 4px 16px rgba(0, 0, 0, 0.2)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.3)',
    xl: '0 12px 48px rgba(0, 0, 0, 0.4)',
    gold: '0 4px 24px rgba(212, 175, 55, 0.3)',
    glow: '0 0 20px rgba(212, 175, 55, 0.4)',
  },
  
  // Glassmorphism
  glass: {
    light: {
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    medium: {
      background: 'rgba(255, 255, 255, 0.15)',
      backdropFilter: 'blur(15px)',
      border: '1px solid rgba(255, 255, 255, 0.25)',
    },
    dark: {
      background: 'rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
    },
  },
  
  // Transitions
  transitions: {
    fast: '0.15s ease',
    medium: '0.3s ease',
    slow: '0.5s ease',
  },
  
  // Breakpoints
  breakpoints: {
    mobile: '640px',
    tablet: '768px',
    desktop: '1024px',
    wide: '1280px',
  },
};

// Helper functions for creating styled elements
export const glassStyle = (variant: 'light' | 'medium' | 'dark' = 'medium') => ({
  background: THEME.glass[variant].background,
  backdropFilter: THEME.glass[variant].backdropFilter,
  WebkitBackdropFilter: THEME.glass[variant].backdropFilter,
  border: THEME.glass[variant].border,
});

export const goldButton = {
  background: THEME.colors.gold.primary,
  color: THEME.colors.primary.dark,
  border: 'none',
  borderRadius: THEME.borderRadius.sm,
  padding: '16px 32px',
  fontSize: THEME.typography.sizes.body.regular,
  fontWeight: THEME.typography.weights.semibold,
  cursor: 'pointer',
  transition: THEME.transitions.medium,
  boxShadow: THEME.shadows.gold,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

export const greenButton = {
  background: `linear-gradient(135deg, ${THEME.colors.green.primary} 0%, ${THEME.colors.green.dark} 100%)`,
  color: THEME.colors.text.primary,
  border: 'none',
  borderRadius: THEME.borderRadius.md,
  padding: '16px 32px',
  fontSize: THEME.typography.sizes.body.regular,
  fontWeight: THEME.typography.weights.semibold,
  cursor: 'pointer',
  transition: THEME.transitions.medium,
  boxShadow: '0 4px 24px rgba(46, 125, 50, 0.3)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

export const whatsappButton = {
  background: THEME.colors.green.whatsapp,
  color: THEME.colors.text.primary,
  border: 'none',
  borderRadius: THEME.borderRadius.md,
  padding: '16px 32px',
  fontSize: THEME.typography.sizes.body.regular,
  fontWeight: THEME.typography.weights.semibold,
  cursor: 'pointer',
  transition: THEME.transitions.medium,
  boxShadow: '0 4px 16px rgba(37, 211, 102, 0.4)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

export const darkGlassButton = {
  ...glassStyle('dark'),
  color: THEME.colors.text.primary,
  padding: '16px 32px',
  fontSize: THEME.typography.sizes.body.regular,
  fontWeight: THEME.typography.weights.semibold,
  cursor: 'pointer',
  transition: THEME.transitions.medium,
  borderRadius: THEME.borderRadius.md,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};
