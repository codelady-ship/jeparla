package az.jeparla.admin.dto;

import az.jeparla.store.LegalType;
import az.jeparla.store.SellerKind;
import az.jeparla.store.Store;
import az.jeparla.store.StoreStatus;
import az.jeparla.store.dto.StoreDto;
import az.jeparla.store.dto.StoreDtos;
import az.jeparla.verification.CheckStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * A store in the admin panel (#40): marketplace status and the separate Jeparla Verified checks.
 *
 * @param productCount the store's products that are not deleted, in any status (a real count: 0 means none)
 * @param whatsapp     the store's WhatsApp number, E.164
 * @param phone        the store's phone, E.164, or null
 * @param address      the street address the seller gave
 * @param geo          the map point the seller set (#116), or null: the admin opens it in a map and checks it
 *                     against the address
 * @param legalHoldAt  when an admin placed a legal hold on the store's evidence (#138, #249), or null; the reason
 *                     is read with GET /admin/stores/{id}/legal-hold
 */
@Schema(name = "AdminStore", requiredProperties = {
        "id", "slug", "name", "city", "sellerKind", "legalType", "taxId", "status", "sellerStatus", "documentsStatus",
        "ownerName", "createdAt", "productCount", "whatsapp", "address", "geo"})
public record AdminStoreDto(long id, String slug, String name, String city, SellerKind sellerKind,
        LegalType legalType, @Schema(nullable = true) String taxId, StoreStatus status, String statusNote,
        CheckStatus sellerStatus, CheckStatus documentsStatus, String ownerName, String ownerContact,
        Instant createdAt, Instant approvedAt,
        long productCount, String whatsapp, @Schema(nullable = true) String phone, String address,
        @Schema(nullable = true) StoreDto.GeoDto geo, @Schema(nullable = true) Instant legalHoldAt) {

    public static AdminStoreDto of(Store store, long productCount) {
        String contact = store.getOwner().getEmail() != null ? store.getOwner().getEmail() : store.getOwner().getPhone();
        return new AdminStoreDto(store.getId(), store.getSlug(), store.getName(), store.getCity(), store.getSellerKind(),
                store.getLegalType(), store.getTaxId(), store.getStatus(), store.getStatusNote(),
                store.getSellerStatus(), store.getDocumentsStatus(), store.getOwner().getDisplayName(), contact,
                store.getCreatedAt(), store.getApprovedAt(), productCount, store.getWhatsapp(), store.getPhone(),
                store.getAddress(), StoreDtos.geo(store), store.getLegalHoldAt());
    }
}
