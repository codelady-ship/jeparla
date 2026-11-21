package az.jeparla.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Create or replace an occasion collection (#115). All three names are required (V63).
 *
 * @param slug      the page address {@code /collections/{slug}}: lower-case Latin letters and digits in words joined
 *                  by single hyphens, unique. Changing it breaks shared links, so the admin form warns.
 * @param sortOrder position in the list (default: after the last one); {@code PUT .../order} sets every position
 * @param active    shown on the site and in the seller form (default true); a hidden one keeps its tags
 */
@Schema(name = "CollectionRequest", requiredProperties = {"slug", "name"})
public record CollectionRequest(
        @NotBlank @Size(max = 80) @Pattern(regexp = CategoryRequest.SLUG) @Schema(example = "nisan") String slug,
        @NotNull @Valid CategoryRequest.NameRequest name,
        @Min(0) @Max(100_000) Integer sortOrder,
        Boolean active) {
}
