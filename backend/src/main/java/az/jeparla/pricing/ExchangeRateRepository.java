package az.jeparla.pricing;

import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExchangeRateRepository extends JpaRepository<ExchangeRate, Long> {

    /** The rate in use: the newest bulletin date. */
    Optional<ExchangeRate> findFirstByCurrencyOrderByRateDateDesc(String currency);

    /** Idempotent job: is this day already stored? */
    boolean existsByCurrencyAndRateDate(String currency, LocalDate rateDate);
}
