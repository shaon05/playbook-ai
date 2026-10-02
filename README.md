# PlayBook AI

PlayBook AI is an Expo/React Native mobile reading companion for turning private documents into listenable, resumable reading sessions.

## Current status

This repository contains the Phase 0/1 mobile shell: a dark-first home screen, library, upload entry point, profile, book detail, demo processing state, demo player, design tokens, and architecture documentation. The displayed books and playback state are labeled demo behavior; no paid AI providers, authentication, uploads, or subscriptions are connected yet.

## Run locally

```bash
npm install
npm start
```

Then choose an emulator, device, or web browser from the Expo CLI. Useful checks:

```bash
npm run lint
npm run typecheck
npx expo-doctor
```

Read `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` before adding backend work. The next phase is Supabase authentication and protected-route/session handling.
