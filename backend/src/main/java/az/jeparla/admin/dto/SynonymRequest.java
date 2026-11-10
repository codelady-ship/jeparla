package az.jeparla.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Create or replace a search synonym pair (#40). Each side is one word: after folding (Azerbaijani letters to
 * Latin, lower case) 2-40 letters or digits without spaces, and the two sides differ (400
 * {@code admin.synonym_invalid}). The same pair in either order exists only once (409 {@code admin.synonym_exists}).
 */
@Schema(name = "SynonymRequest", requiredProperties = {"term", "synonym"})
public record SynonymRequest(
        @NotBlank @Size(max = 60) @Schema(example = "serqa") String term,
        @NotBlank @Size(max = 60) @Schema(example = "sırğa") String synonym) {
}
