package az.jeparla.admin.dto;

import az.jeparla.collection.OccasionCollection;
import az.jeparla.common.dto.LocalizedTextDto;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * An occasion collection in the admin catalog settings (#115): hidden ones too.
 *
 * @param productCount tagged products that are not deleted, in any status (the public list counts listed ones)
 */
@Schema(name = "AdminCollection", requiredProperties = {"id", "slug", "name", "sortOrder", "active", "productCount"})
public record AdminCollectionDto(long id, String slug, LocalizedTextDto name, int sortOrder, boolean active,
        long productCount) {

    public static AdminCollectionDto of(OccasionCollection collection, long productCount) {
        return new AdminCollectionDto(collection.getId(), collection.getSlug(),
                LocalizedTextDto.of(collection.getName()), collection.getSortOrder(), collection.isActive(),
                productCount);
    }
}
