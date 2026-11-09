package az.jeparla.pricing;

import az.jeparla.common.web.CachePolicy;
import az.jeparla.pricing.dto.MetalPriceDto;
import az.jeparla.product.Metal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Daily CBAR metal quotes for the price widget and /qiymetler (PLAN 5.10). Anonymous, cacheable. */
@RestController
@RequestMapping("/api/v1/metal-prices")
@Tag(name = "Metal prices", description = "CBAR quotes in AZN, applied by the daily job (#43)")
public class MetalPriceController {

    static final int MAX_DAYS = 366;

    private final MetalPriceQueryService prices;

    public MetalPriceController(MetalPriceQueryService prices) {
        this.prices = prices;
    }

    @GetMapping("/latest")
    @Operation(summary = "Latest quote of each metal")
    public ResponseEntity<List<MetalPriceDto>> latest() {
        return ResponseEntity.ok().cacheControl(CachePolicy.REFERENCE).body(prices.latest());
    }

    @GetMapping("/history")
    @Operation(summary = "Quote history of one metal", description = "The last `days` quotes, oldest first.")
    @ApiResponse(responseCode = "200", description = "Quotes")
    @ApiResponse(responseCode = "400", description = "Unknown metal or days out of range")
    public ResponseEntity<List<MetalPriceDto>> history(@RequestParam Metal metal,
            @Parameter(description = "1-" + MAX_DAYS + ", default 30")
            @RequestParam(defaultValue = "30") @Min(1) @Max(MAX_DAYS) int days) {
        return ResponseEntity.ok().cacheControl(CachePolicy.REFERENCE).body(prices.history(metal, days));
    }
}
