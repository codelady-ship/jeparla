package az.jeparla.merchant.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/v1/merchant/products/{id}/images/from-draft} (#109): the photo of one of the store's drafts
 * becomes a photo of the product, and the draft is used up.
 *
 * @param altAz optional alt text in Azerbaijani (the product name by default in the form)
 */
public record DraftImageRequest(@NotNull @Positive Long draftId, @Size(max = 200) String altAz) {
}
