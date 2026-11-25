package az.jeparla.merchant.dto;

import az.jeparla.product.Metal;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Metal sibling of a product (V70): the linked product of the same design in another metal, and the store's
 * products that may be linked (precious, another metal, not deleted).
 *
 * @param siblingId the linked product, or null
 */
public record MetalSiblingsDto(@Schema(nullable = true) Long siblingId, List<Option> options) {

    /**
     * @param linkedElsewhere already linked to another product: choosing it moves the link here
     */
    public record Option(long id, String name, Metal metal, boolean linkedElsewhere) {
    }
}
