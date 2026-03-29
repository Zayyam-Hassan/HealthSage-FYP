/**
 * HealthSage Typography System
 * Extracted from Figma design specifications
 */

export const fonts = {
  // Font Families
  families: {
    primary: 'System', // Will be updated with custom font if available
    secondary: 'System',
    mono: 'SpaceMono-Regular', // Existing font
  },
  
  // Font Sizes
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  
  // Font Weights
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  
  // Line Heights
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2,
  },
  
  // Letter Spacing
  letterSpacing: {
    tighter: -0.5,
    tight: -0.25,
    normal: 0,
    wide: 0.25,
    wider: 0.5,
  },
};

export type FontSize = keyof typeof fonts.sizes;
export type FontWeight = keyof typeof fonts.weights;

