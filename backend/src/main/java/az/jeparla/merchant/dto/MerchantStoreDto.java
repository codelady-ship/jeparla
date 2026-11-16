package az.jeparla.merchant.dto;

import az.jeparla.store.LegalType;
import az.jeparla.store.SellerCode;
import az.jeparla.store.SellerKind;
import az.jeparla.store.Store;
import az.jeparla.store.StoreStatus;
import az.jeparla.store.dto.StoreDto;
import az.jeparla.store.dto.StoreDtos;
import az.jeparla.verification.CheckStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * The seller's own store ({@code MerchantStore} in frontend/src/types/merchant.ts, plus status fields the
 * cabinet shows). {@code description} is the Azerbaijani text the seller writes.
 *
 * @param status          marketplace status decided by an admin (PENDING until approved)
 * @param statusNote      reason of the last reject or block, or null
 * @param documentsStatus always NONE for a FASHION store (#128)
 * @param codeVersion     the seller code of conduct version the store has to accept (#107)
 * @param codeAcceptedAt  when the store last accepted the current version, or null
 * @param codeValidUntil  when that acceptance runs out (a year later); after it, or when null, products cannot
 *                        go to review until the seller accepts again
 * @param geo             the saved map point for "near me" (#116), or null; set from a map link or coordinates
 */
@Schema(name = "MerchantStore")
public record MerchantStoreDto(
        long id,
        String slug,
        String name,
        String city,
        String address,
        String whatsapp,
        @Schema(nullable = true) String phone,
        String social,
        String description,
        String openingHours,
        LegalType legalType,
        String taxId,
        SellerKind sellerKind,
        StoreStatus status,
        @Schema(nullable = true) String statusNote,
        CheckStatus sellerStatus,
        CheckStatus documentsStatus,
        int codeVersion,
        @Schema(nullable = true, format = "date-time") String codeAcceptedAt,
        @Schema(nullable = true, format = "date-time") String codeValidUntil,
        @Schema(nullable = true) StoreDto.GeoDto geo) {

    public static MerchantStoreDto of(Store store) {
        Instant validUntil = SellerCode.validUntil(store);
        return new MerchantStoreDto(store.getId(), store.getSlug(), store.getName(), store.getCity(),
                store.getAddress(), store.getWhatsapp(), store.getPhone(), nullToEmpty(store.getSocial()),
                store.getDescription() == null ? "" : nullToEmpty(store.getDescription().az()),
                nullToEmpty(store.getOpeningHours()), store.getLegalType(), store.getTaxId(), store.getSellerKind(),
                store.getStatus(), store.getStatusNote(), store.getSellerStatus(), store.getDocumentsStatus(),
                SellerCode.CURRENT_VERSION, acceptedAt(store), validUntil == null ? null : validUntil.toString(),
                StoreDtos.geo(store));
    }

    private static String acceptedAt(Store store) {
        return SellerCode.validUntil(store) == null ? null : store.getCodeAcceptedAt().toString();
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
