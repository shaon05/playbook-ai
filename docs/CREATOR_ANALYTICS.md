# Creator analytics

Creator analytics are private and authorized through the authenticated user, their active `creator_profiles` row, and the requested catalog content ownership. The daily aggregate schema stores counts only; it does not expose listener IDs, names, or emails. Dashboard metrics include qualified listens, unique listeners, listening seconds, completions, favorites, followers, shares, and impressions.

The current qualified-listen MVP rule is at least 30 listening seconds or 10% progress. Completion is at least 90% progress. Monetization measures qualified listening time as integer `qualified_listening_seconds`; the full threshold is `500 * 3600` seconds. Existing `qualified_listens` remains an analytics count for compatibility and is not the monetization threshold. Stronger anti-fraud and scheduled aggregation are required before public monetization.
