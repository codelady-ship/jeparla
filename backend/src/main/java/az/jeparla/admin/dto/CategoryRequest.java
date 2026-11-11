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
 * Create or replace a category (#40). All three names are required (V3). {@code parentId} null makes a root;
 * a category cannot move under itself or one of its subcategories (409 {@code admin.category_cycle}).
 *
 * @param slug      lower-case Latin letters and digits in words joined by single hyphens, unique
 * @param sortOrder position among its siblings (default 0)
 * @param active    shown in the public tree (default true)
 */
@Schema(name = "CategoryRequest", requiredProperties = {"slug", "name"})
public record CategoryRequest(
        @NotBlank @Size(max = 120) @Pattern(regexp = SLUG) @Schema(example = "uzukler") String slug,
        @Schema(nullable = true) Long parentId,
        @NotNull @Valid NameRequest name,
        @Min(0) @Max(100_000) Integer sortOrder,
        Boolean active) {

    /** V3 {@code categories_slug_format}. */
    public static final String SLUG = "[a-z0-9]+(-[a-z0-9]+)*";

    /** Category names: az, en and ru, each 1-80 characters. */
    @Schema(name = "CategoryName", requiredProperties = {"az", "en", "ru"})
    public record NameRequest(@NotBlank @Size(max = 80) String az, @NotBlank @Size(max = 80) String en,
            @NotBlank @Size(max = 80) String ru) {
    }
}
