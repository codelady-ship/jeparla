/**
 * Merchant cabinet API ({@code /api/v1/merchant}, #39): the seller's own store, products, variants, stones
 * and images. Every service method checks the MERCHANT role ({@code @PreAuthorize}) and resolves the store
 * or product through the signed-in user (token {@code sub}): another seller's resource is 403, a missing or
 * deleted one 404.
 */
package az.jeparla.merchant;
