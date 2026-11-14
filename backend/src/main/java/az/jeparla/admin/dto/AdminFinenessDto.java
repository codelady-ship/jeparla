package az.jeparla.admin.dto;

import az.jeparla.product.Fineness;
import az.jeparla.product.Metal;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A fineness (assay mark, parts per thousand) in the admin catalog settings (#40, PLAN 4): inactive ones too.
 *
 * @param productCount products (not deleted, any status) with a live variant of this fineness
 * @param inUse        whether any variant ever used it (removed variants too): then it cannot be deleted and its
 *                     metal and value cannot change
 */
@Schema(name = "AdminFineness", requiredProperties = {
        "id", "metal", "value", "label", "sortOrder", "active", "productCount", "inUse"})
public record AdminFinenessDto(long id, Metal metal, @Schema(example = "585") int value,
        @Schema(example = "585 (14K)") String label, int sortOrder, boolean active, long productCount,
        boolean inUse) {

    public static AdminFinenessDto of(Fineness fineness, long productCount, boolean inUse) {
        return new AdminFinenessDto(fineness.getId(), fineness.getMetal(), fineness.getValue(), fineness.getLabel(),
                fineness.getSortOrder(), fineness.isActive(), productCount, inUse);
    }
}
