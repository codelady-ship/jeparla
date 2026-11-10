package az.jeparla.admin.dto;

import az.jeparla.search.SearchSynonym;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * A search synonym pair (V11, #40): a query word equal to either side also finds the other side, in both
 * directions ("serqa" finds "sırğa"). Language-free: matching uses the folded forms.
 */
@Schema(name = "AdminSynonym", requiredProperties = {"id", "term", "synonym", "createdAt"})
public record AdminSynonymDto(long id, @Schema(example = "serqa") String term,
        @Schema(example = "sırğa") String synonym, Instant createdAt) {

    public static AdminSynonymDto of(SearchSynonym synonym) {
        return new AdminSynonymDto(synonym.getId(), synonym.getTerm(), synonym.getSynonym(), synonym.getCreatedAt());
    }
}
