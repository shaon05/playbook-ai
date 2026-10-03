export const TOTAL_REVENUE_SHARE_BPS = 10_000;

export type EarningShareConfig = { creatorBps: number; platformBps: number };
export const DEFAULT_OWN_AUDIO_SHARE: EarningShareConfig = { creatorBps: 6000, platformBps: 4000 };
export const DEFAULT_AI_EARLY_SHARE: EarningShareConfig = { creatorBps: 6000, platformBps: 4000 };
export const DEFAULT_AI_FULL_SHARE: EarningShareConfig = { creatorBps: 8000, platformBps: 2000 };

export type FutureRevenueShare = {
  creatorBps: number;
  platformBps: number;
};

export function validateFutureRevenueShare(share: FutureRevenueShare): FutureRevenueShare {
  if (share.creatorBps < 0 || share.platformBps < 0 || share.creatorBps + share.platformBps !== TOTAL_REVENUE_SHARE_BPS) {
    throw new Error("Invalid revenue share configuration. CREATOR_SHARE_BPS + PLATFORM_SHARE_BPS must equal 10000.");
  }
  return share;
}

export function validateRevenueSharePairs(shares: EarningShareConfig[]): EarningShareConfig[] {
  shares.forEach((share) => validateFutureRevenueShare(share));
  return shares;
}
