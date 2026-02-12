# Card-Scout AI Coding Instructions

## Project Overview

Card-Scout is a React Native trading card finder app for One Piece TCG, using Expo for mobile, TypeScript, and Supabase backend. The app lets users search, filter, and track trading cards.

## Architecture & Data Flow

### Core Components

- **Frontend**: React Native app with Expo (`app/App.tsx` - basic UI; components folder empty)
- **Backend**: Supabase (PostgreSQL) - stores card data, sets, user data
- **Services**: `src/services/cardService.ts` provides card query interface
- **Types**: `src/types/card.ts` defines the Card interface (17 fields including card_id, name, colour, power, effect)

### Database & API Integration

- Two Supabase client instances:
  - `src/lib/supabase.ts` - for React Native (uses AsyncStorage)
  - `src/services/cardService.ts` - Node.js version (direct instantiation)
- Cards table schema: card_id (PK), name, set_id, colour, rarity, power, cost, life, card_type, effect, attribute, counter, sub_type, image_url
- **JustTCG API integration**: `scripts/seed.js` fetches external card data and syncs to Supabase (note: requires JUSTTCG_API_KEY env var)

## Key Development Workflows

### Running Tests & Validation

- `npm run test:cards` - executes `src/services/cardService.ts` directly via tsx (calls `cardService.getCardById("OP01-001")`)
- `npm run seed` - runs `scripts/seed.js` to populate DB from JustTCG API and download images to Supabase Storage

### Environment Setup

- **Required env vars**: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`, `JUSTTCG_API_KEY`, `SUPABASE_SERVICE_KEY` (RLS bypass)
- Defaults: SUPABASE_URL hardcoded as `https://ynhdlnqtzbolovuaxcqx.supabase.co`
- Both client files warn if SUPABASE_KEY is missing

### Running the App

- `npm start` / `npm run android` / `npm run ios` / `npm run web` - Expo standard commands

## Code Patterns & Conventions

### Data Fetching (cardService)

- Uses Supabase query builder with method chaining
- Filters: case-insensitive search via `ilike()`, exact matches via `eq()`
- Pagination: `range(offset, offset + limit - 1)` with limit defaulting to 20
- Error handling: logs to console, throws or returns null depending on method
- **Example**: `getCards({ searchTerm: "Luffy", colour: "red", limit: 50 })`

### Card IDs & Naming

- Format: "OP01-001" (Set prefix + dash + number)
- Used as primary key in searches

### Styling (React Native)

- `StyleSheet.create()` for all styles
- Currently: simple flexbox layout with basic colors

## External Dependencies

- **justtcg-js**: Trading card game API client (card data source)
- **@supabase/supabase-js**: Database & auth
- **axios**: HTTP client (used in seed)
- **expo-router**: Navigation (installed but not yet in use)
- **@react-native-async-storage/async-storage**: Session persistence

## Critical Notes for AI Agents

## Feature Development Patterns

### Search Feature

- Use `cardService.getCards()` with `searchTerm` filter for name-based searches
- Case-insensitive matching via `ilike()` pattern in service layer
- Support chaining filters: combine `searchTerm`, `colour`, `set_id`, and pagination
- UI components in `app/App.tsx` already have TextInput scaffold for search bar

### Favourites/Tracking Feature

- Currently not implemented; requires new Supabase table: `user_favourites` (user_id, card_id, created_at)
- Add to Card type: optional `isFavourite: boolean` flag for UI state
- Store user session via `supabase.auth` (React Native client) with AsyncStorage persistence
- Favourite operations: toggle in `cardService` with user context from auth session

## Critical Notes for AI Agents

1. **Two Supabase Clients**: Don't confuse `supabase` (React Native) vs `supabaseNode` (Node.js). Use appropriately based on context.
2. **Service Key Security**: seed.js needs SUPABASE_SERVICE_KEY for data writes; warns if missing.
3. **Card Image Storage**: Images stored in Supabase Storage bucket `card-images`; image_url field should contain public URLs.
4. **RLS Policies**: May restrict certain operations; seed requires elevated privileges.
5. **TypeScript Strict Mode**: tsconfig enforces strict type checking.
6. **Expo Environment Variables**: Prefixed with `EXPO_PUBLIC_` to be accessible in bundle.

## Files to Reference When Implementing Features

- Card queries: [src/services/cardService.ts](src/services/cardService.ts)
- Type definitions: [src/types/card.ts](src/types/card.ts)
- Database seeding: [scripts/seed.js](scripts/seed.js) (shows full card schema & filtering patterns)
- UI scaffold: [app/App.tsx](app/App.tsx) (basic component structure with StyleSheet)

## Git Conventions

### Commit Messages

- Focus on **impact and progress**: describe what was achieved, not just what changed
- Examples: "Add search feature with filters", "Fix pagination bug in card list", "Connect favourites to Supabase"
- Avoid: overly technical details or implementation minutiae

### Branch Strategy

- Create branches for **experimental features** (not for minor fixes)
- Branch naming: descriptive, e.g., `feature/search-filters`, `feature/user-favourites`
- Keep main branch stable; merge experimental branches when feature is complete and tested
