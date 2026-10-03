# Future revenue configuration

The canonical future net-distributable revenue defaults are `CREATOR_SHARE_BPS=8000` and `PLATFORM_SHARE_BPS=2000`. The values must total `10000` basis points.

The API has centralized future revenue-share configuration in `apps/api/src/config/revenue.ts`, loaded from server-only environment variables:

- `CREATOR_OWN_AUDIO_SHARE_BPS=6000`
- `PLATFORM_OWN_AUDIO_SHARE_BPS=4000`

Own creator-supplied audio uses 60/40 after full monetization. Paid `CREATOR_COMMERCIAL` PlayBook AI generation uses 60/40 for `EARLY_EARNING` and 80/20 after full monetization. Every pair is validated to total `10000` basis points. These percentages apply to future NET DISTRIBUTABLE REVENUE only. No retroactive upgrade is performed; future accounting must snapshot terms per earning event. This configuration does not calculate earnings, enable monetization, process payouts, or implement billing.
