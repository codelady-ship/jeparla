package az.jeparla.collection.dto;

import az.jeparla.collection.OccasionCollection;
import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.product.dto.ProductImageDto;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A shown occasion collection ({@code OccasionCollection} in frontend/src/types/api.ts, #115).
 *
 * @param productCount listed products tagged with it; 0 means the page shows an empty state and stays out of the
 *                     sitemap
 * @param cover        the card photo: the main photo of one of its newest listed products (never an AI image, see
 *                     {@code CollectionService#shown()}); null without one
 */
@Schema(name = "OccasionCollection", requiredProperties = {"id", "slug", "name", "productCount", "cover"})
public record CollectionDto(long id, String slug, LocalizedTextDto name, long productCount,
        @Schema(nullable = true, description = "Main photo of a listed product tagged with the collection, never an "
                + "AI image; null when there is none") ProductImageDto cover) {

    public static CollectionDto of(OccasionCollection collection, long productCount, ProductImageDto cover) {
        return new CollectionDto(collection.getId(), collection.getSlug(), LocalizedTextDto.of(collection.getName()),
                productCount, cover);
    }
}
