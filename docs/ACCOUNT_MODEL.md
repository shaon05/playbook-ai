# PlayBook account model

PlayBook has one Supabase Auth identity and three product experiences: Guest Listener, Registered Listener, and Creator. A Creator is an authenticated listener with a one-to-one `creator_profiles` record; no second email/password system exists.

Capabilities are derived from authentication state, subscription plan (`FREE` or `PREMIUM`), and creator status (`NONE`, `PENDING`, `ACTIVE`, `SUSPENDED`). The server derives upload, favorite, progress sync, premium audio, offline, publishing, analytics, and advertising entitlements. The mobile client never submits an entitlement override.

Guests can browse and listen to eligible public content. Personal library, favorites, synced progress, Remember, downloads, and private PDF upload require authentication and should show a product signup prompt.

Private PDF upload and creator publication are separate workflows. A private upload is never automatically added to the public catalog. Creator Studio is not a bottom tab and is available only after creator approval.

`verificationStatus` and `monetizationStatus` are reported independently from `creatorStatus` and `plan`. An `ACTIVE` creator does not automatically receive Premium capabilities: `canUsePremiumAudio`, `canDownloadOffline`, and `adsEnabled` remain plan-derived.
