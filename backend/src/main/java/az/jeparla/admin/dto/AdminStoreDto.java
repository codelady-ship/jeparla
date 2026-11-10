package az.jeparla.admin.dto;

import az.jeparla.store.LegalType;
import az.jeparla.store.SellerKind;
import az.jeparla.store.Store;
import az.jeparla.store.StoreStatus;
import az.jeparla.verification.CheckStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/** A store in the admin panel (#40): marketplace status and the separate Jeparla Verified checks. */
@Schema(name = "AdminStore", requiredProperties = {
        "id", "slug", "name", "city", "sellerKind", "legalType", "taxId", "status", "sellerStatus", "documentsStatus",
        "ownerName", "createdAt"})
public record AdminStoreDto(long id, String slug, String name, String city, SellerKind sellerKind,
        LegalType legalType, String taxId, StoreStatus status, String statusNote, CheckStatus sellerStatus,
        CheckStatus documentsStatus, String ownerName, String ownerContact, Instant createdAt, Instant approvedAt) {

    public static AdminStoreDto of(Store store) {
        String contact = store.getOwner().getEmail() != null ? store.getOwner().getEmail() : store.getOwner().getPhone();
        return new AdminStoreDto(store.getId(), store.getSlug(), store.getName(), store.getCity(), store.getSellerKind(),
                store.getLegalType(), store.getTaxId(), store.getStatus(), store.getStatusNote(),
                store.getSellerStatus(), store.getDocumentsStatus(), store.getOwner().getDisplayName(), contact,
                store.getCreatedAt(), store.getApprovedAt());
    }
}
