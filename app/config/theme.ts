// Premium Dark + Gold Theme Configuration
// Master theme for cinematic premium UI

export const THEME = {
  // Color Palette - Premium Dark + Gold
  colors: {
    // Primary - Dark Navy/Black
    primary: {
      dark: '#0A0E1A',      // Deep dark background
      navy: '#1A1F2E',      // Navy background
      slate: '#2D3748',     // Medium dark
    },
    
    // Accent - Premium Gold
    gold: {
      primary: '#D4AF37',   // Rich gold
      light: '#E5C158',     // Light gold
      dark: '#B8941F',      // Dark gold
    },
    
    // Text Colors
    text: {
      primary: '#FFFFFF',   // White text
      secondary: '#E2E8F0', // Light gray
      muted: '#94A3B8',     // Muted gray
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
      display: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
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
  background: `linear-gradient(135deg, ${THEME.colors.gold.primary} 0%, ${THEME.colors.gold.dark} 100%)`,
  color: THEME.colors.primary.dark,
  border: 'none',
  borderRadius: THEME.borderRadius.md,
  padding: '16px 32px',
  fontSize: THEME.typography.sizes.body.regular,
  fontWeight: THEME.typography.weights.semibold,
  cursor: 'pointer',
  transition: THEME.transitions.medium,
  boxShadow: THEME.shadows.gold,
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
