# Analytics aggregation

`npm run analytics:aggregate` computes an idempotent UTC daily aggregate from trusted `user_content_events` and `listening_sessions` rows. It writes `creator_content_analytics_daily` using the date/content/creator key. Set `ANALYTICS_DATE=YYYY-MM-DD` to rebuild a specific day. Client-provided totals are never accepted as analytics facts.

Before public launch, add scheduled execution, late-event reconciliation, retention rules, and operational monitoring.

`currentFavorites` and `currentFollowers` should be read from the authoritative favorite/follow tables. `favorites_added` and `followers_gained` describe changes during the selected day and must come from deduplicated trusted mutation events, not client totals. Guest analytics remain deferred without fingerprinting.
