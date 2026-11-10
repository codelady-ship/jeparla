/**
 * Request and response DTOs of the merchant cabinet API ({@code frontend/src/types/merchant.ts}). Money and
 * weight are decimals: {@code BigDecimal} in requests (a JSON number or string, validated with
 * {@code @Digits} against the column scale, so nothing is rounded), decimal strings in responses.
 */
package az.jeparla.merchant.dto;
