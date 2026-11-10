package az.jeparla.admin.dto;

import az.jeparla.product.MaterialKind;
import az.jeparla.product.Product;
import az.jeparla.product.ProductStatus;
import az.jeparla.verification.CheckStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/** A product in the moderation queue (#40). */
@Schema(name = "AdminProduct", requiredProperties = {
        "id", "slug", "name", "storeId", "storeName", "materialKind", "status", "expertiseStatus"})
public record AdminProductDto(long id, String slug, String name, long storeId, String storeName,
        MaterialKind materialKind, ProductStatus status, CheckStatus expertiseStatus, String reviewNote,
        Instant submittedAt, Instant publishedAt) {

    public static AdminProductDto of(Product product) {
        return new AdminProductDto(product.getId(), product.getSlug(), product.getName().az(),
                product.getStore().getId(), product.getStore().getName(), product.getMaterialKind(),
                product.getStatus(), product.getExpertiseStatus(), product.getReviewNote(), product.getSubmittedAt(),
                product.getPublishedAt());
    }
}
