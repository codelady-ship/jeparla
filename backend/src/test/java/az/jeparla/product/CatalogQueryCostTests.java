package az.jeparla.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.CatalogApiTest;
import jakarta.persistence.EntityManagerFactory;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * No N+1 in the catalog endpoints: a request costs the same number of SQL statements for a small and
 * a large page (collections load in batches), and the 60-product demo catalog answers quickly. Each
 * request runs in its own transaction here (no shared persistence context), like in production.
 */
@CatalogApiTest
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class CatalogQueryCostTests {

    private static final Logger log = LoggerFactory.getLogger(CatalogQueryCostTests.class);

    @Autowired
    private MockMvc mvc;

    @Autowired
    private EntityManagerFactory emf;

    private long statements(String request) throws Exception {
        Statistics stats = emf.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        mvc.perform(get(URI.create(request))).andExpect(status().isOk());
        return stats.getPrepareStatementCount();
    }

    @ParameterizedTest(name = "{0} vs {1}")
    @CsvSource({
            "/api/v1/products?size=3, /api/v1/products?size=48",
            "/api/v1/products?size=3&sort=price_asc, /api/v1/products?size=48&sort=price_asc",
            "/api/v1/products?size=2&category=uzukler&inStock=true&shape=OVAL, /api/v1/products?size=96&inStock=true",
            "/api/v1/stores/ayzer-zerger/products?size=2, /api/v1/stores/ayzer-zerger/products?size=10",
            "/api/v1/products?ids=1, '/api/v1/products?ids=1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20'",
            "/api/v1/variants?ids=10, '/api/v1/variants?ids=10,20,30,40'",
    })
    void listsCostTheSameNumberOfStatementsForAnyPageSize(String small, String large) throws Exception {
        long smallCount = statements(small);
        long largeCount = statements(large);
        log.info("SQL statements: {} -> {}, {} -> {}", small, smallCount, large, largeCount);
        // categories, page, count, then stores, images, variants, finenesses and stones in batches
        assertThat(largeCount).isLessThanOrEqualTo(9).isLessThanOrEqualTo(smallCount + 1);
    }

    @Test
    void otherEndpointsHaveAFixedCost() throws Exception {
        assertThat(statements("/api/v1/products/nisan-uzukleri-gold-585-1")).isLessThanOrEqualTo(7);
        assertThat(statements("/api/v1/categories")).isLessThanOrEqualTo(2);
        assertThat(statements("/api/v1/finenesses")).isOne();
        assertThat(statements("/api/v1/stores")).isLessThanOrEqualTo(3);
        assertThat(statements("/api/v1/stores/ayzer-zerger")).isLessThanOrEqualTo(3);
        assertThat(statements("/api/v1/metal-prices/latest")).isLessThanOrEqualTo(4);
    }

    /** Issue #37: the catalog query over 60 products under 200 ms (measured locally, warm). */
    @Test
    void theWholeDemoCatalogIsFast() throws Exception {
        String request = "/api/v1/products?size=60&sort=price_asc&inStock=true";
        for (int i = 0; i < 5; i++) {
            mvc.perform(get(URI.create(request))).andExpect(jsonPath("$.content").isArray());
        }
        List<Long> millis = new ArrayList<>();
        for (int i = 0; i < 9; i++) {
            long start = System.nanoTime();
            mvc.perform(get(URI.create(request))).andExpect(status().isOk());
            millis.add((System.nanoTime() - start) / 1_000_000);
        }
        millis.sort(null);
        long median = millis.get(millis.size() / 2);
        log.info("GET {}: median {} ms, all {}", request, median, millis);
        assertThat(median).as("median response time in ms").isLessThan(200);
    }
}
