package az.jeparla.product.dto;

import az.jeparla.product.Metal;
import io.swagger.v3.oas.annotations.media.Schema;

/** The same design in another metal of the same store (V69), shown as a Qizil / Gumus switch on the product page. */
@Schema(name = "MetalSibling")
public record MetalSiblingDto(String slug, Metal metal) {
}
