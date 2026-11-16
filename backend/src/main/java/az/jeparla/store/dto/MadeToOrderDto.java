package az.jeparla.store.dto;

import az.jeparla.store.Store;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * Made to order as the store declares it (#108): its own statement, not checked by Jeparla. In
 * {@code PUT /api/v1/merchant/store} an absent object keeps the saved answer and {@code offered: null}
 * clears it; the days are dropped unless {@code offered} is true.
 *
 * @param offered whether the store makes pieces to order
 * @param days    usual days to make a piece, 1-365, or null
 */
@Schema(name = "MadeToOrder", requiredProperties = {"offered", "days"})
public record MadeToOrderDto(
        Boolean offered,
        @Schema(nullable = true) @Min(1) @Max(MadeToOrderDto.MAX_DAYS) Integer days) {

    public static final int MAX_DAYS = 365;

    /** The store's answer, or null when it has not declared one. */
    public static MadeToOrderDto of(Store store) {
        return store.getMadeToOrder() == null ? null
                : new MadeToOrderDto(store.getMadeToOrder(), store.getMadeToOrderDays());
    }
}
