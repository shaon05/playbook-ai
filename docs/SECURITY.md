# Security

The mobile bundle may contain only public Expo/Supabase configuration. OpenAI, ElevenLabs, AWS secret credentials, Supabase service-role keys, and Google private credentials remain server/worker-only.

Uploads are private by default and use presigned access. Every book query checks authenticated ownership server-side. User-facing errors are safe and actionable; provider details and stack traces stay in server logs. Deletion must remove source assets, generated audio, and associated metadata where appropriate.

## Phase 2 authentication

The mobile client uses only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Sessions persist through SecureStore on native and AsyncStorage on web, with automatic token refresh while the app is active. The Supabase service-role key is never read by the mobile client.

The `profiles` table is protected by RLS. Profile reads and updates are constrained by `auth.uid() = id`; the database trigger creates the profile from signup metadata so mobile completion is not required for account setup.

The existing `playbookai://auth/callback` scheme is used for password-reset callbacks. Google and Apple remain disabled until their provider credentials and redirect settings are configured in Supabase and the respective provider consoles.
