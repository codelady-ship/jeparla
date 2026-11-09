package az.jeparla.store.dto;

import az.jeparla.store.Store;
import az.jeparla.verification.dto.VerificationDto;
import io.swagger.v3.oas.annotations.media.Schema;

/** The store on a product card ({@code Pick<StoreSummary, "id" | "slug" | "name" | "city" | "verification">}). */
@Schema(name = "ProductStore", requiredProperties = {"id", "slug", "name", "city", "verification"})
public record StoreRefDto(long id, String slug, String name, String city, VerificationDto verification) {

    public static StoreRefDto of(Store store) {
        return new StoreRefDto(store.getId(), store.getSlug(), store.getName(), store.getCity(),
                StoreDtos.verification(store));
    }
}
