# Listening analytics

Authenticated public listening uses `listening_sessions`. Clients submit only validated progress deltas; the API derives `qualified` and `completed` from centralized thresholds. Sessions avoid per-second event logging. Anonymous guest analytics are reserved for a later privacy-reviewed endpoint and no device fingerprinting is used.
