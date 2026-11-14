package az.jeparla.product.dto;

import az.jeparla.product.EvidenceKind;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A hallmark or label photo on the product page (#106): what the seller showed, not a laboratory assay (PLAN 5.9).
 * Photos an admin rejected are not listed. The alt text comes from the frontend messages for the kind.
 *
 * @param url     absolute URL in the public bucket
 * @param checked an admin compared the photo with the product data and found it matching (VERIFIED); false while
 *                it waits for the check
 */
@Schema(name = "EvidencePhoto", requiredProperties = {"kind", "url", "width", "height", "checked"})
public record EvidencePhotoDto(EvidenceKind kind, String url, int width, int height, boolean checked) {
}
