package az.jeparla.merchant.dto;

import az.jeparla.store.LegalType;
import az.jeparla.store.SellerKind;
import az.jeparla.store.Store;
import az.jeparla.store.StoreStatus;
import az.jeparla.verification.CheckStatus;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The seller's own store ({@code MerchantStore} in frontend/src/types/merchant.ts, plus status fields the
 * cabinet shows). {@code description} is the Azerbaijani text the seller writes.
 *
 * @param status          marketplace status decided by an admin (PENDING until approved)
 * @param statusNote      reason of the last reject or block, or null
 * @param documentsStatus always NONE for a FASHION store (#128)
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
        CheckStatus documentsStatus) {

    public static MerchantStoreDto of(Store store) {
        return new MerchantStoreDto(store.getId(), store.getSlug(), store.getName(), store.getCity(),
                store.getAddress(), store.getWhatsapp(), store.getPhone(), nullToEmpty(store.getSocial()),
                store.getDescription() == null ? "" : nullToEmpty(store.getDescription().az()),
                nullToEmpty(store.getOpeningHours()), store.getLegalType(), store.getTaxId(), store.getSellerKind(),
                store.getStatus(), store.getStatusNote(), store.getSellerStatus(), store.getDocumentsStatus());
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
