package az.jeparla.merchant.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** New photo order ({@code PUT /api/v1/merchant/products/{id}/images/order}): every image id once, cover first. */
public record ImageOrderRequest(@NotEmpty @Size(max = 50) List<@NotNull Long> imageIds) {
}
