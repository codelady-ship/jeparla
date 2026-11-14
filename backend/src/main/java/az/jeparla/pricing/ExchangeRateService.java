package az.jeparla.pricing;

import az.jeparla.pricing.cbar.CbarBulletin;
import az.jeparla.pricing.dto.ExchangeRateDto;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * USD/EUR display rates (#53). The metal price job stores them from the same CBAR bulletin; the public
 * endpoint reads the newest one. Never used to price or charge: AZN stays the only stored price.
 */
@Service
public class ExchangeRateService {

    /** Display currencies, in the order the endpoint lists them. */
    public static final List<String> CURRENCIES = List.of("USD", "EUR");

    private final ExchangeRateRepository rates;

    public ExchangeRateService(ExchangeRateRepository rates) {
        this.rates = rates;
    }

    /** Stores the bulletin's USD/EUR rates once per day; returns how many were new. */
    @Transactional
    public int store(CbarBulletin bulletin, Instant fetchedAt) {
        int stored = 0;
        for (String currency : CURRENCIES) {
            BigDecimal rate = bulletin.currencyRates().get(currency);
            if (rate == null || rates.existsByCurrencyAndRateDate(currency, bulletin.date())) {
                continue;
            }
            rates.save(new ExchangeRate(currency, bulletin.date(), rate, fetchedAt));
            stored++;
        }
        return stored;
    }

    /** The newest rate of each display currency that has one. */
    @Transactional(readOnly = true)
    public List<ExchangeRateDto> latest() {
        return CURRENCIES.stream()
                .map(rates::findFirstByCurrencyOrderByRateDateDesc)
                .flatMap(Optional::stream)
                .map(ExchangeRateDto::of)
                .toList();
    }
}
