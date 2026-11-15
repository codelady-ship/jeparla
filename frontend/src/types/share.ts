import type { IsoDate, Verification } from "./api";

/**
 * Store share link, link preview, referral statistics (#100) and measured trust facts (#108).
 * Same shapes as the backend DTOs (ShareLink, StorePreview, ReferralStats, StoreFacts in
 * /v3/api-docs). A value that is not known is null, never a made-up zero.
 */

/** GET /api/v1/merchant/store/share */
export type ShareLink = {
  code: string;
  /** `https://jeparla.az/s/<code>` */
  url: string;
  /** `url?ref=qr`: what the QR code encodes. */
  qrUrl: string;
  /** False until the store is approved: the link answers 404 until then. */
  active: boolean;
};

/** GET /api/v1/stores/{slug}/preview and /api/v1/share/{code} */
export type StorePreview = {
  slug: string;
  name: string;
  city: string;
  /** The seller check is VERIFIED. */
  verified: boolean;
  verification: Verification;
  productCount: number;
  /** First photo of the newest listed product; a `/demo/...` path is relative to the site. */
  coverImageUrl: string | null;
  logoUrl: string | null;
};

export const REFERRAL_SOURCES = [
  "INSTAGRAM",
  "TIKTOK",
  "WHATSAPP",
  "TAPAZ",
  "FACEBOOK",
  "TELEGRAM",
  "YOUTUBE",
  "QR",
  "LINK",
  "OTHER",
] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

export const REFERRAL_DAYS = [30, 90] as const;
export type ReferralDays = (typeof REFERRAL_DAYS)[number];

/** GET /api/v1/merchant/referrals?days=30|90 */
export type ReferralStats = {
  days: number;
  /** Window start or the store's creation day, whichever is later (yyyy-MM-dd, Baku). */
  from: string;
  to: string;
  visits: number;
  whatsappClicks: number;
  sources: { source: ReferralSource; visits: number; whatsappClicks: number }[];
  /** Every day from `from` to `to`, real zeros included. */
  daily: { day: string; visits: number; whatsappClicks: number }[];
};

/** A part of the listed products; `percent` is rounded down and null without listed products. */
export type StoreFactShare = { count: number; percent: number | null };

/** GET /api/v1/stores/{slug}/facts (computed from the database on every request). */
export type StoreFacts = {
  onJeparlaSince: IsoDate | null;
  monthsOnJeparla: number | null;
  activeProducts: number;
  catalogUpdatedAt: IsoDate | null;
  verifiedExpertise: StoreFactShare;
  metalLinkedPrice: StoreFactShare;
  /** Always null for now: photos are not tagged as hallmark photos yet. */
  hallmarkPhoto: StoreFactShare | null;
  /** Null for a store that sells only fashion jewellery (no documents check). */
  documents: { taxId: boolean; tradeLicense: boolean } | null;
};
