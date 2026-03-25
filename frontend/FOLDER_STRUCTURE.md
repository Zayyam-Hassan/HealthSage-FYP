# Movie App - Folder Structure

```
movie-app/
│
├── app/                          # Main application directory (Expo Router)
│   ├── _layout.tsx              # Root layout component
│   ├── global.css               # Global styles
│   │
│   ├── (tabs)/                  # Tab navigation group
│   │   ├── _layout.tsx          # Tab layout configuration
│   │   ├── index.tsx            # Home tab screen
│   │   ├── profile.tsx          # Profile tab screen
│   │   ├── saved.tsx            # Saved movies tab screen
│   │   └── search.tsx           # Search tab screen
│   │
│   └── movies/                  # Movies feature directory
│       └── [id].tsx             # Dynamic movie detail page
│
├── assets/                       # Static assets
│   ├── fonts/                   # Font files
│   │   └── SpaceMono-Regular.ttf
│   │
│   ├── icons/                   # Icon images
│   │   ├── arrow.png
│   │   ├── home.png
│   │   ├── logo.png
│   │   ├── person.png
│   │   ├── play.png
│   │   ├── save.png
│   │   ├── search.png
│   │   └── star.png
│   │
│   └── images/                  # Image assets
│       ├── bg.png
│       ├── highlight.png
│       ├── logo.png
│       └── rankingGradient.png
│
├── components/                   # Reusable React components
│   └── searchbar.tsx            # Search bar component
│
├── constants/                    # Application constants
│   ├── icons.ts                 # Icon constants/definitions
│   └── images.ts                # Image constants/definitions
│
├── interfaces/                   # TypeScript interfaces
│   └── interfaces.d.ts          # Interface definitions
│
├── types/                       # TypeScript type definitions
│   └── images.d.ts              # Image type definitions
│
├── node_modules/                # Dependencies (npm packages)
│
├── .gitignore                   # Git ignore rules (if exists)
│
├── app.json                     # Expo app configuration
├── babel.config.js              # Babel configuration
├── eslint.config.js             # ESLint configuration
├── expo-env.d.ts                # Expo TypeScript environment types
├── metro.config.js              # Metro bundler configuration
├── nativewind-env.d.ts          # NativeWind TypeScript types
├── package.json                 # Project dependencies and scripts
├── package-lock.json            # Locked dependency versions
├── README.md                    # Project documentation
├── tailwind.config.js           # Tailwind CSS configuration
└── tsconfig.json                # TypeScript configuration
```

## Technology Stack

- **Framework**: React Native with Expo
- **Routing**: Expo Router (file-based routing)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Language**: TypeScript
- **Navigation**: Tab-based navigation with dynamic routes

## Key Directories

- **app/**: Contains all screens and routes using Expo Router's file-based routing system
- **components/**: Reusable UI components
- **assets/**: Static files (images, icons, fonts)
- **constants/**: Application-wide constants and configurations
- **interfaces/**: TypeScript interface definitions
- **types/**: TypeScript type definitions

