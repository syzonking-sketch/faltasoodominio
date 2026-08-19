# Plan: Finalize "The Match" Application

Complete the remaining technical infrastructure to make the app fully functional and production-ready.

## User Review Required

> [!IMPORTANT]
> To connect the backend, you will need to run the generated SQL migration in your Supabase SQL Editor and set the Environment Variables in the project settings.

## Proposed Changes

### Infrastructure & Backend
- **SQL Migration**: Generate a comprehensive `supabase/migrations/initial_schema.sql` containing:
    - Tables: `profiles`, `venues`, `matches`, `match_participants`, `ratings`, `teams`, `team_members`, `match_confrontos`.
    - Views: `player_rankings` for the leaderboard.
    - Security: Enable RLS on all tables and grant necessary permissions to `authenticated` and `anon` roles.
- **Environment Setup**: Instructions for setting `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### PWA & Mobile Experience
- **Manifest**: Create `public/manifest.json` with app name, colors, and standalone display mode.
- **Root Setup**: Update `src/routes/__root.tsx` to include:
    - PWA meta tags (`theme-color`, `apple-touch-icon`).
    - **Sonner Toaster**: Mount the `<Toaster />` component to enable visual feedback for user actions.

### UI Refinements
- Ensure all toast notifications are visible and working correctly.
- Verify that the "Conexão não configurada" warning disappears once keys are set.

## Technical Details

### SQL Schema Structure
- `profiles`: Linked to `auth.users`, stores nicknames, avatars, and location (city/state).
- `venues`: GPS coordinates, name, and address.
- `matches`: Tracks active/finished status, scores, and venue links.
- `match_participants`: Links users to matches with roles (player/spectator) and check-in status.
- `teams` & `team_members`: Clan management with membership status (pending/active).
- `match_confrontos`: Logic for cross-validated scores between team captains.

### PWA Configuration
- Icons will use standard placeholders until custom ones are provided.
- Manifest will be linked in the root route head.
