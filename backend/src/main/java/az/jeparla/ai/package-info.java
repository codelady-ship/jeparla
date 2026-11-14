/**
 * AI Studio ({@code /api/v1/merchant/ai}, #55, PLAN 5.12): asynchronous image jobs from a seller's product
 * photo, behind a provider-neutral interface ({@code az.jeparla.ai.provider}). No provider ships with the API:
 * {@code jeparla.ai.image-provider=none} is the default and AI Studio reports "not configured" (docs/ai-providers.md).
 * Every service method checks the MERCHANT role and the product's owner; nothing generated is public before the
 * seller approves it, and an approved image is always marked {@code aiGenerated}.
 */
package az.jeparla.ai;
