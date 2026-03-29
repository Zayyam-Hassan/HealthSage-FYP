/**
 * HealthSage Color Palette
 * Calm, clinical palette: trustworthy contrast for healthcare workflows.
 */

export const colors = {
  // Primary Colors — deep teal (professional, readable on white)
  primary: {
    main: '#1a5f6b',
    light: '#2a7d8c',
    dark: '#134854',
    contrast: '#FFFFFF',
  },

  // Secondary Colors
  secondary: {
    main: '#2d8a6e',
    light: '#3da382',
    dark: '#236f57',
    contrast: '#FFFFFF',
  },

  // Accent — restrained slate-blue for highlights, not playful purple
  accent: {
    main: '#4a6fa5',
    light: '#6b8bc4',
    dark: '#3d5d8a',
  },

  /** Figma-inspired warm coral — CTAs, headers, highlights (healthcare-premium) */
  coral: {
    main: '#faad9e',
    light: '#fcd2ca',
    soft: 'rgba(250, 173, 158, 0.22)',
    muted: 'rgba(250, 173, 158, 0.38)',
    deep: '#e89588',
    ink: '#2f4055',
  },

  /** Near-white cards from Figma (#fcfcfc) */
  surface: {
    soft: '#fcfcfc',
  },

  // Background Colors
  background: {
    primary: '#FFFFFF',
    secondary: '#f1f5f7',
    tertiary: '#e2e9ed',
    dark: '#0F0D23',
    card: '#FFFFFF',
  },
  
  // Text Colors
  text: {
    primary: '#1A1A1A',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
    disabled: '#D1D5DB',
  },
  
  // Status Colors
  status: {
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  
  // Border Colors
  border: {
    light: '#E5E7EB',
    medium: '#D1D5DB',
    dark: '#9CA3AF',
    /** Soft neutral border used in Figma-inspired form fields */
    input: 'rgba(103, 114, 148, 0.16)',
  },

  // Form surfaces — calm, readable; aligns with soft card + field patterns
  input: {
    surface: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
  },
  
  // Overlay Colors
  overlay: {
    light: 'rgba(0, 0, 0, 0.1)',
    medium: 'rgba(0, 0, 0, 0.5)',
    dark: 'rgba(0, 0, 0, 0.7)',
  },
  
  // Legacy support (for existing code)
  light: {
    100: '#D6C6FF',
    200: '#A8B5DB',
    300: '#9CA4AB',
  },
  dark: {
    100: '#221F3D',
    200: '#0F0D23',
  },
};

export type ColorKey = keyof typeof colors;

