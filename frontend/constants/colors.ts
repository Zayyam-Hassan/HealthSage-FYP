/**
 * HealthSage Color Palette
 * Extracted from Figma design system
 */

export const colors = {
  // Primary Colors
  primary: {
    main: '#faad9e', // HealthSage primary color
    light: '#ffc4b8',
    dark: '#e89684',
    contrast: '#FFFFFF',
  },
  
  // Secondary Colors
  secondary: {
    main: '#50C878', // Healthcare green
    light: '#6FD48A',
    dark: '#3FA865',
    contrast: '#FFFFFF',
  },
  
  // Accent Colors
  accent: {
    main: '#AB8BFF',
    light: '#C4B0FF',
    dark: '#8B6DFF',
  },
  
  // Background Colors
  background: {
    primary: '#FFFFFF',
    secondary: '#F5F7FA',
    tertiary: '#E8ECF0',
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

