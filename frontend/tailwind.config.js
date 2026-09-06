/** @type {import('tailwindcss').Config} */
const { colors } = require('./constants/colors');
const { fonts } = require('./constants/fonts');
const { theme } = require('./constants/theme');

module.exports = {
  // Include all files where NativeWind/Tailwind classes are used
  content: [
    "./App.{js,jsx,ts,tsx}", // In case App.* exists
    "./app/**/*.{js,jsx,ts,tsx}", // All files in app folder (layout.tsx, index.tsx, screens, etc.)
    "./components/**/*.{js,jsx,ts,tsx}", // All reusable components
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary Colors
        primary: colors.primary.main,
        'primary-light': colors.primary.light,
        'primary-dark': colors.primary.dark,
        
        // Secondary Colors
        secondary: colors.secondary.main,
        'secondary-light': colors.secondary.light,
        'secondary-dark': colors.secondary.dark,
        
        // Accent Colors
        accent: colors.accent.main,
        'accent-light': colors.accent.light,
        'accent-dark': colors.accent.dark,

        // Figma warm coral + soft surface
        coral: colors.coral.main,
        'coral-light': colors.coral.light,
        'coral-soft': colors.coral.soft,
        'coral-muted': colors.coral.muted,
        'coral-deep': colors.coral.deep,
        'coral-ink': colors.coral.ink,
        'surface-soft': colors.surface.soft,
        
        // Background Colors
        background: colors.background.primary,
        'bg-secondary': colors.background.secondary,
        'bg-tertiary': colors.background.tertiary,
        'bg-dark': colors.background.dark,
        'bg-card': colors.background.card,
        
        // Text Colors
        text: colors.text.primary,
        'text-secondary': colors.text.secondary,
        'text-tertiary': colors.text.tertiary,
        'text-inverse': colors.text.inverse,
        'text-disabled': colors.text.disabled,
        
        // Status Colors
        success: colors.status.success,
        error: colors.status.error,
        warning: colors.status.warning,
        info: colors.status.info,
        
        // Border Colors
        border: colors.border.light,
        'border-medium': colors.border.medium,
        'border-dark': colors.border.dark,
        
        // Legacy support
        light: colors.light,
        dark: colors.dark,
      },
      fontFamily: {
        primary: [fonts.families.primary],
        secondary: [fonts.families.secondary],
        mono: [fonts.families.mono],
      },
      fontSize: {
        xs: [`${fonts.sizes.xs}px`, { lineHeight: `${fonts.sizes.xs * fonts.lineHeights.normal}px` }],
        sm: [`${fonts.sizes.sm}px`, { lineHeight: `${fonts.sizes.sm * fonts.lineHeights.normal}px` }],
        base: [`${fonts.sizes.base}px`, { lineHeight: `${fonts.sizes.base * fonts.lineHeights.normal}px` }],
        md: [`${fonts.sizes.md}px`, { lineHeight: `${fonts.sizes.md * fonts.lineHeights.normal}px` }],
        lg: [`${fonts.sizes.lg}px`, { lineHeight: `${fonts.sizes.lg * fonts.lineHeights.normal}px` }],
        xl: [`${fonts.sizes.xl}px`, { lineHeight: `${fonts.sizes.xl * fonts.lineHeights.normal}px` }],
        '2xl': [`${fonts.sizes['2xl']}px`, { lineHeight: `${fonts.sizes['2xl'] * fonts.lineHeights.normal}px` }],
        '3xl': [`${fonts.sizes['3xl']}px`, { lineHeight: `${fonts.sizes['3xl'] * fonts.lineHeights.normal}px` }],
        '4xl': [`${fonts.sizes['4xl']}px`, { lineHeight: `${fonts.sizes['4xl'] * fonts.lineHeights.normal}px` }],
      },
      spacing: theme.spacing,
      borderRadius: theme.borderRadius,
    },
  },
  plugins: [],
};
