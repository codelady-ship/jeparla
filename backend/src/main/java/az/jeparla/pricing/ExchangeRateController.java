package az.jeparla.pricing;

import az.jeparla.common.web.CachePolicy;
import az.jeparla.pricing.dto.ExchangeRateDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** CBAR USD/EUR rates for the approximate price display (#53). Anonymous, cacheable. */
@RestController
@RequestMapping("/api/v1/exchange-rates")
@Tag(name = "Exchange rates", description = "CBAR AZN rates of USD and EUR, display only (#53)")
public class ExchangeRateController {

    private final ExchangeRateService rates;

    public ExchangeRateController(ExchangeRateService rates) {
        this.rates = rates;
    }

    @GetMapping("/latest")
    @Operation(summary = "Latest AZN rate of USD and EUR",
            description = "AZN per one unit. Prices are in AZN; converted prices are approximate.")
    public ResponseEntity<List<ExchangeRateDto>> latest() {
        return ResponseEntity.ok().cacheControl(CachePolicy.REFERENCE).body(rates.latest());
    }
}
