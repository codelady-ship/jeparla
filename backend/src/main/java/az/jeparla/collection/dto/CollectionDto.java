package az.jeparla.collection.dto;

import az.jeparla.collection.OccasionCollection;
import az.jeparla.common.dto.LocalizedTextDto;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A shown occasion collection ({@code OccasionCollection} in frontend/src/types/api.ts, #115).
 *
 * @param productCount listed products tagged with it; 0 means the page shows an empty state and stays out of the
 *                     sitemap
 */
@Schema(name = "OccasionCollection", requiredProperties = {"id", "slug", "name", "productCount"})
public record CollectionDto(long id, String slug, LocalizedTextDto name, long productCount) {

    public static CollectionDto of(OccasionCollection collection, long productCount) {
        return new CollectionDto(collection.getId(), collection.getSlug(), LocalizedTextDto.of(collection.getName()),
                productCount);
    }
}
