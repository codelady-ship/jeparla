package az.jeparla.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * The new order of the occasion collections (#115): every collection id, hidden ones too, exactly once.
 */
@Schema(name = "CollectionOrderRequest", requiredProperties = {"ids"})
public record CollectionOrderRequest(@NotEmpty @Size(max = 200) List<@NotNull Long> ids) {
}
