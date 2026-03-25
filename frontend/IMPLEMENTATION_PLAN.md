# HealthSage UI Implementation Plan

## 📋 Overview

This document outlines the complete implementation plan for rebuilding the HealthSage app UI to match the Figma design pixel-perfectly, while preserving all existing core setup, navigation, and backend integration.

---

## 🎯 Screens Identified from Figma

Based on the Figma design analysis, the following screens need to be implemented:

### Authentication Flow
1. **Splash Screen** (`splash screen` - multiple variants)
2. **Login Screen** (`LOGIN SCREEN`)
3. **Signup Screen** (`signup`)
4. **Forgot Password** (`fp` - multiple variants)

### Main App Flow
5. **Home Screen** (`05_Home screen` - multiple variants)
6. **Psychiatrist Hunt** (`Psychiatrist Hunt`)
7. **Book Appointment** (`Book Appointment` - multiple variants)
8. **Patient Details** (`Patient details`)
9. **Report** (`report` - multiple variants)
10. **Chatbot** (`Chatbot` - multiple variants)

### Settings & Legal
11. **Settings** (`Settings`)
12. **Privacy Policy** (`Privacy policy screen`)

---

## 📁 File Structure Plan

### New Screen Files to Create

```
app/
├── (auth)/                          # Authentication group
│   ├── login.tsx                    # Login screen
│   ├── signup.tsx                   # Signup screen
│   └── forgot-password.tsx          # Forgot password screen
│
├── onboarding/                     # Onboarding flow
│   └── index.tsx                    # Splash/onboarding screens
│
├── (tabs)/                          # EXISTING - DO NOT MODIFY STRUCTURE
│   ├── _layout.tsx                  # PRESERVE - Tab navigation config
│   ├── index.tsx                    # UPDATE - Home screen (was movie home)
│   ├── search.tsx                    # UPDATE - Psychiatrist Hunt/Search
│   ├── saved.tsx                    # UPDATE - Appointments/Reports
│   └── profile.tsx                  # UPDATE - Profile/Settings
│
├── psychiatrist/                    # Psychiatrist feature
│   ├── index.tsx                    # Psychiatrist Hunt/List
│   └── [id].tsx                     # Psychiatrist Details
│
├── appointments/                    # Appointments feature
│   ├── index.tsx                    # Appointments list
│   ├── book.tsx                     # Book Appointment
│   └── [id].tsx                     # Appointment Details
│
├── patient/                         # Patient feature
│   └── [id].tsx                     # Patient Details
│
├── reports/                         # Reports feature
│   ├── index.tsx                    # Reports list
│   └── [id].tsx                     # Report Details
│
├── chatbot/                         # Chatbot feature
│   └── index.tsx                    # Chatbot screen
│
└── settings/                        # Settings feature
    ├── index.tsx                    # Settings screen
    └── privacy.tsx                  # Privacy Policy
```

### Components Structure

```
components/
├── Button/                          # Button component variants
│   ├── index.tsx
│   └── types.ts
│
├── Input/                           # Form input components
│   ├── index.tsx
│   └── types.ts
│
├── Header/                          # Screen headers
│   └── index.tsx
│
├── Card/                            # Card components
│   ├── PsychiatristCard.tsx
│   ├── AppointmentCard.tsx
│   ├── ReportCard.tsx
│   └── index.tsx
│
├── Avatar/                          # Avatar component
│   └── index.tsx
│
├── Badge/                           # Badge/Status components
│   └── index.tsx
│
├── SectionHeader/                   # Section headers
│   └── index.tsx
│
├── Tabs/                            # Tab components
│   └── index.tsx
│
├── Loader/                          # Loading states
│   └── index.tsx
│
├── EmptyState/                      # Empty states
│   └── index.tsx
│
├── SearchBar/                       # UPDATE existing searchbar.tsx
│   └── index.tsx
│
└── Chatbot/                         # Chatbot components
    ├── MessageBubble.tsx
    └── index.tsx
```

### Constants Structure

```
constants/
├── icons.ts                         # UPDATE - Add HealthSage icons
├── images.ts                        # UPDATE - Add HealthSage images
├── theme.ts                         # NEW - Theme tokens
├── colors.ts                        # NEW - Color palette
└── fonts.ts                         # NEW - Font definitions
```

### Assets Structure

```
assets/
├── fonts/                           # EXISTING - Preserve
│   └── SpaceMono-Regular.ttf
│
├── icons/                           # UPDATE - Replace with HealthSage icons
│   ├── home.png
│   ├── search.png
│   ├── appointments.png
│   ├── profile.png
│   ├── chat.png
│   ├── calendar.png
│   ├── user.png
│   ├── settings.png
│   └── [other HealthSage icons]
│
└── images/                          # UPDATE - Replace with HealthSage images
    ├── logo.png
    ├── splash-bg.png
    ├── onboarding-*.png
    └── [other HealthSage images]
```

---

## 🎨 Theme System Implementation

### `constants/theme.ts`

```typescript
// Theme tokens extracted from Figma
export const theme = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  shadows: {
    sm: { /* Figma shadow values */ },
    md: { /* Figma shadow values */ },
    lg: { /* Figma shadow values */ },
  },
  // ... other design tokens
};
```

### `constants/colors.ts`

```typescript
// Color palette from Figma
export const colors = {
  primary: {
    main: '#[Figma Primary]',
    light: '#[Figma Primary Light]',
    dark: '#[Figma Primary Dark]',
  },
  secondary: {
    main: '#[Figma Secondary]',
    // ...
  },
  background: {
    primary: '#[Figma BG]',
    secondary: '#[Figma BG Secondary]',
    // ...
  },
  text: {
    primary: '#[Figma Text Primary]',
    secondary: '#[Figma Text Secondary]',
    // ...
  },
  status: {
    success: '#[Figma Success]',
    error: '#[Figma Error]',
    warning: '#[Figma Warning]',
    info: '#[Figma Info]',
  },
  // ... all colors from Figma
};
```

### `constants/fonts.ts`

```typescript
// Font definitions from Figma
export const fonts = {
  families: {
    primary: '[Figma Font Family]',
    secondary: '[Figma Font Family]',
  },
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    // ... all sizes from Figma
  },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    // ... all weights from Figma
  },
  lineHeights: {
    // ... from Figma
  },
};
```

### `tailwind.config.js` Updates

```javascript
// Extend with HealthSage theme tokens
module.exports = {
  // ... existing config
  theme: {
    extend: {
      colors: {
        // Map Figma colors to Tailwind
        primary: colors.primary,
        secondary: colors.secondary,
        // ...
      },
      fontFamily: {
        // Map Figma fonts
      },
      spacing: {
        // Map Figma spacing
      },
      borderRadius: {
        // Map Figma border radius
      },
      // ... other theme extensions
    },
  },
};
```

---

## 🧩 Component Specifications

### Button Component
- **Variants**: Primary, Secondary, Outline, Text, Icon
- **Sizes**: Small, Medium, Large
- **States**: Default, Hover, Active, Disabled, Loading
- **Props**: `variant`, `size`, `loading`, `disabled`, `onPress`, `icon`, `fullWidth`

### Input Component
- **Types**: Text, Email, Password, Phone, Number, Search
- **States**: Default, Focused, Error, Disabled
- **Props**: `type`, `label`, `placeholder`, `error`, `helperText`, `icon`, `required`

### Card Components
- **PsychiatristCard**: Image, name, specialty, rating, location, availability
- **AppointmentCard**: Date, time, doctor, status, actions
- **ReportCard**: Title, date, type, preview, actions

### Header Component
- **Variants**: Default, WithBack, WithActions, Search
- **Props**: `title`, `showBack`, `rightActions`, `onBackPress`

---

## 📱 Screen Implementation Details

### 1. Splash Screen (`app/onboarding/index.tsx`)
- **Elements**: Logo, app name, loading indicator
- **Animation**: Fade in/out, logo animation
- **Navigation**: Auto-navigate to login/home after delay

### 2. Login Screen (`app/(auth)/login.tsx`)
- **Elements**: Logo, email input, password input, login button, forgot password link, signup link
- **Validation**: Email format, password requirements
- **States**: Loading, error messages

### 3. Signup Screen (`app/(auth)/signup.tsx`)
- **Elements**: Form fields (name, email, password, confirm password), signup button, login link
- **Validation**: All field validations, password match
- **States**: Loading, error messages, success

### 4. Forgot Password (`app/(auth)/forgot-password.tsx`)
- **Elements**: Email input, submit button, back to login
- **Flow**: Email sent confirmation screen

### 5. Home Screen (`app/(tabs)/index.tsx`)
- **Elements**: Header, search bar, quick actions, upcoming appointments, recent reports, recommendations
- **Sections**: Hero section, quick access cards, lists
- **Navigation**: Links to all main features

### 6. Psychiatrist Hunt (`app/(tabs)/search.tsx` OR `app/psychiatrist/index.tsx`)
- **Elements**: Search bar, filters, psychiatrist list/cards
- **Features**: Search, filter by specialty/location/rating, sort options
- **Navigation**: To psychiatrist details

### 7. Book Appointment (`app/appointments/book.tsx`)
- **Elements**: Doctor selection, date picker, time slots, reason input, confirm button
- **Flow**: Multi-step form or single screen
- **Validation**: All required fields

### 8. Patient Details (`app/patient/[id].tsx`)
- **Elements**: Patient info, medical history, appointments list, reports list
- **Sections**: Profile, medical records, timeline

### 9. Reports (`app/(tabs)/saved.tsx` OR `app/reports/index.tsx`)
- **Elements**: Report list/cards, filters, search
- **Features**: View, download, share reports
- **Navigation**: To report details

### 10. Chatbot (`app/chatbot/index.tsx`)
- **Elements**: Chat interface, message bubbles, input field, send button
- **Features**: Real-time messages, typing indicator, quick replies

### 11. Settings (`app/(tabs)/profile.tsx` OR `app/settings/index.tsx`)
- **Elements**: Profile info, settings list, logout button
- **Sections**: Account, notifications, privacy, about

### 12. Privacy Policy (`app/settings/privacy.tsx`)
- **Elements**: Scrollable content, formatted text, back button

---

## 🔄 Navigation Mapping

### Tab Navigation (Preserve Existing Structure)
- **Tab 1** (`index.tsx`): Home Screen
- **Tab 2** (`search.tsx`): Psychiatrist Hunt/Search
- **Tab 3** (`saved.tsx`): Appointments/Reports
- **Tab 4** (`profile.tsx`): Profile/Settings

### Stack Navigation (New Routes)
- Authentication stack: `(auth)/login`, `(auth)/signup`, `(auth)/forgot-password`
- Psychiatrist stack: `psychiatrist/index`, `psychiatrist/[id]`
- Appointments stack: `appointments/index`, `appointments/book`, `appointments/[id]`
- Reports stack: `reports/index`, `reports/[id]`
- Settings stack: `settings/index`, `settings/privacy`

---

## 📦 Dependencies to Install

### Required Dependencies

```bash
# Already installed (verify versions):
- expo-router ✅
- nativewind ✅
- react-native-safe-area-context ✅
- react-native-gesture-handler ✅
- react-native-reanimated ✅

# May need to install:
expo install expo-linear-gradient        # For gradients
expo install @react-native-community/datetimepicker  # For date/time pickers
expo install react-native-svg            # For SVG icons (if needed)
expo install expo-blur                   # For blur effects (if in Figma)
```

### Optional Dependencies (Based on Figma Features)

```bash
# If Figma has charts:
expo install react-native-chart-kit     # Or similar chart library

# If Figma has image picker:
expo install expo-image-picker

# If Figma has camera:
expo install expo-camera

# If Figma has notifications:
expo install expo-notifications
```

---

## 🎯 Implementation Phases

### Phase 1: Foundation
1. ✅ Create theme system (`constants/theme.ts`, `colors.ts`, `fonts.ts`)
2. ✅ Update `tailwind.config.js` with HealthSage theme
3. ✅ Update `app/global.css` with custom styles
4. ✅ Create base components (Button, Input, Card, etc.)

### Phase 2: Authentication
1. ✅ Implement Splash Screen
2. ✅ Implement Login Screen
3. ✅ Implement Signup Screen
4. ✅ Implement Forgot Password Screen

### Phase 3: Main App Screens
1. ✅ Update Home Screen (`app/(tabs)/index.tsx`)
2. ✅ Implement Psychiatrist Hunt
3. ✅ Implement Book Appointment
4. ✅ Update Saved/Reports Screen
5. ✅ Update Profile/Settings Screen

### Phase 4: Feature Screens
1. ✅ Implement Patient Details
2. ✅ Implement Report Details
3. ✅ Implement Chatbot
4. ✅ Implement Settings & Privacy

### Phase 5: Polish & Assets
1. ✅ Replace all icons with HealthSage icons
2. ✅ Replace all images with HealthSage images
3. ✅ Add animations and transitions
4. ✅ Final pixel-perfect adjustments

---

## ⚠️ Critical Preservation Rules

### DO NOT MODIFY:
- ❌ `app/_layout.tsx` - Root layout structure
- ❌ `app/(tabs)/_layout.tsx` - Tab navigation configuration
- ❌ `babel.config.js` - Babel configuration
- ❌ `metro.config.js` - Metro bundler config
- ❌ `tsconfig.json` - TypeScript config
- ❌ `app.json` - Expo configuration (unless adding new assets)
- ❌ Folder structure - Only add new files, don't restructure

### PRESERVE:
- ✅ Existing navigation logic
- ✅ Existing API integration points
- ✅ Existing data interfaces/types
- ✅ Existing utility functions
- ✅ Existing constants structure (extend, don't replace)

---

## 🔍 Design Extraction Checklist

Before implementation, extract from Figma:

- [ ] All color values (hex codes)
- [ ] All font families, sizes, weights, line heights
- [ ] All spacing values (margins, paddings)
- [ ] All border radius values
- [ ] All shadow values
- [ ] All icon assets (export as PNG/SVG)
- [ ] All image assets
- [ ] All button styles and states
- [ ] All input field styles and states
- [ ] All card styles
- [ ] All navigation bar styles
- [ ] All tab bar styles
- [ ] All animation timings and easing
- [ ] All screen dimensions and layouts
- [ ] All component variants

---

## 📝 Next Steps

1. **Review this plan** - Confirm all screens and structure
2. **Extract design tokens** - Get exact values from Figma
3. **Approve plan** - Give go-ahead to start implementation
4. **Phase-by-phase implementation** - Follow the phases above
5. **Testing** - Test each screen matches Figma exactly

---

## 🎨 Design System Notes

- All measurements must match Figma exactly (use pixel values)
- All colors must match Figma hex codes exactly
- All typography must match Figma specifications exactly
- All spacing must follow Figma's 8px/4px grid system
- All shadows and effects must match Figma
- All animations must match Figma timing and easing

---

**Status**: ⏳ Awaiting Approval

**Ready to proceed once approved!** 🚀

