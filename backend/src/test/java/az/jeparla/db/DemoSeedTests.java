package az.jeparla.db;

import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.common.i18n.Language;
import az.jeparla.pricing.PricingEngine;
import az.jeparla.product.Category;
import az.jeparla.product.CategoryRepository;
import az.jeparla.product.PricingMode;
import az.jeparla.product.Product;
import az.jeparla.product.ProductRepository;
import az.jeparla.product.ProductVariant;
import az.jeparla.product.StockStatus;
import az.jeparla.support.WithPostgres;
import jakarta.persistence.EntityManager;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * The {@code demo} profile loads the same catalog as frontend/src/lib/api/mock/fixtures.ts
 * (#33): same ids, slugs, names and prices. The expected prices were computed with the
 * frontend pricing code (big.js) from the same rules.
 */
@WithPostgres
@SpringBootTest
@ActiveProfiles("demo")
class DemoSeedTests {

    /** priceFrom of fixture products 1..60 (PRODUCTS[i].priceFrom.amount). */
    private static final List<String> FIXTURE_PRICES = List.of(
            "508.75", "104.86", "1440.00", "388.82", "1929.48", "50.00", "1433.21", "1075.52", "440.00", "148.30",
            "1133.95", "1250.00", "1896.48", "94.84", "2200.00", "469.06", "2101.12", "190.00", "842.60", "2338.01",
            "2160.00", "138.28", "287.33", "610.00", "2761.69", "84.82", "3170.00", "265.89", "665.96", "180.00",
            "1004.36", "1665.49", "450.00", "128.25", "2746.55", "800.00", "2056.94", "74.79", "780.00", "431.53",
            "1629.57", "170.00", "905.24", "832.24", "570.00", "118.23", "2724.86", "500.00", "1175.17", "64.77",
            "2660.00", "2081.31", "782.95", "160.00", "1127.56", "1129.88", "1920.00", "108.21", "998.52", "980.00");

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ProductRepository products;

    @Autowired
    private CategoryRepository categories;

    @Autowired
    private EntityManager em;

    private long count(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class);
    }

    @Test
    void seedHasTheFixtureCounts() {
        assertThat(count("stores")).isEqualTo(6);
        assertThat(count("categories")).isEqualTo(12);
        assertThat(count("finenesses")).isEqualTo(6);
        assertThat(count("products")).isEqualTo(60);
        assertThat(count("product_variants")).isEqualTo(60);
        assertThat(count("product_images")).isEqualTo(73);
        assertThat(count("product_stones")).isEqualTo(18);
        assertThat(count("metal_price_snapshots")).isEqualTo(4);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
                WHERE r.name = 'MERCHANT' AND u.email LIKE 'demo-merchant-%@jeparla.test'
                """, Long.class)).isEqualTo(6);
        // 60 products over 6 stores, 10 each, as in the fixtures.
        assertThat(jdbc.queryForList("SELECT count(*) FROM products GROUP BY store_id", Long.class))
                .hasSize(6).containsOnly(10L);
    }

    @Test
    void pricesAndIdsMatchTheFrontendFixtures() {
        assertThat(FIXTURE_PRICES).hasSize(60);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT p.id, v.id AS variant_id, v.sku, v.price, v.weight_grams FROM products p
                JOIN product_variants v ON v.product_id = p.id ORDER BY p.id
                """);
        assertThat(rows).hasSize(60);
        for (int i = 0; i < 60; i++) {
            Map<String, Object> row = rows.get(i);
            long id = i + 1;
            assertThat(row.get("id")).isEqualTo(id);
            assertThat(row.get("variant_id")).as("defaultVariantId").isEqualTo(id * 10);
            assertThat(row.get("sku")).isEqualTo("JP-%04d".formatted(id));
            assertThat(row.get("price")).as("price of product %d", id).isEqualTo(new BigDecimal(FIXTURE_PRICES.get(i)));
        }
    }

    /**
     * The pricing engine (#44) reproduces every METAL_LINKED price of the seed, which the test above
     * compares with the frontend (big.js) fixtures: engine = pricing.ts on the whole demo catalog.
     */
    @Test
    @Transactional
    void pricingEngineReproducesTheMetalLinkedPrices() {
        List<ProductVariant> linked = em.createQuery("""
                select v from ProductVariant v join fetch v.fineness join fetch v.metalSnapshot
                where v.pricingMode = :mode
                """, ProductVariant.class).setParameter("mode", PricingMode.METAL_LINKED).getResultList();
        assertThat(linked).hasSizeGreaterThan(30);
        for (ProductVariant variant : linked) {
            BigDecimal price = PricingEngine.price(variant.getWeightGrams(), variant.getFineness().getValue(),
                    variant.getMetalSnapshot().getPricePerGram(), new PricingEngine.Rule(variant.getLaborPerGram(),
                            variant.getLaborFixed(), variant.getStonePrice(), variant.getMarkupPercent(),
                            variant.getMinPrice(), variant.getMaxPrice()));
            assertThat(price).as("variant %d", variant.getId()).isEqualTo(variant.getPrice());
            assertThat(PricingEngine.gramPrice(variant.getMetalSnapshot().getPricePerOunce()))
                    .isEqualTo(variant.getMetalSnapshot().getPricePerGram());
        }
    }

    @Test
    void gramPricesFollowTheCbarRule() {
        Map<String, BigDecimal> grams = jdbc.query("SELECT metal, price_per_gram FROM metal_price_snapshots",
                rs -> {
                    Map<String, BigDecimal> map = new java.util.HashMap<>();
                    while (rs.next()) {
                        map.put(rs.getString(1), rs.getBigDecimal(2));
                    }
                    return map;
                });
        assertThat(grams).containsOnly(
                Map.entry("GOLD", new BigDecimal("225.0552")),
                Map.entry("SILVER", new BigDecimal("2.7328")),
                Map.entry("PLATINUM", new BigDecimal("93.2372")),
                Map.entry("PALLADIUM", new BigDecimal("80.3769")));
    }

    @Test
    @Transactional
    void firstProductLooksLikeTheFixture() {
        Product product = products.findPublicBySlug("nisan-uzukleri-gold-585-1").orElseThrow();
        assertThat(product.getId()).isEqualTo(1L);
        assertThat(product.getName().az()).isEqualTo("Leyla — qızıl nişan üzüyü 585");
        assertThat(product.getName().en()).isEqualTo("Leyla — gold engagement ring 585");
        assertThat(product.getName().ru()).isEqualTo("Лейла — помолвочное кольцо из золота 585");
        assertThat(product.getDescription().in(Language.AZ)).isEqualTo("Leyla — qızıl nişan üzüyü 585. Nümunə məhsul, real deyil.");
        assertThat(product.getStore().getSlug()).isEqualTo("ayzer-zerger");
        assertThat(product.getStore().getWhatsapp()).isEqualTo("+994500000001");
        assertThat(product.getCategory().getSlug()).isEqualTo("nisan-uzukleri");
        assertThat(product.getPublishedAt()).isEqualTo(Instant.parse("2026-10-01T09:00:00Z"));

        ProductVariant variant = product.getVariants().getFirst();
        assertThat(variant.getPricingMode()).isEqualTo(PricingMode.METAL_LINKED);
        assertThat(variant.getWeightGrams()).isEqualTo(new BigDecimal("1.200"));
        assertThat(variant.getFineness().getValue()).isEqualTo(585);
        assertThat(variant.getSize()).isEqualTo("17");
        assertThat(variant.getStonePrice()).isEqualTo(new BigDecimal("250.00"));
        assertThat(variant.getMetalSnapshot().getPricePerGram()).isEqualTo(new BigDecimal("225.0552"));
        assertThat(variant.getStockStatus()).isEqualTo(StockStatus.IN_STOCK);

        // i = 0: two shots of the gold ring pool (one photo) would repeat, so only one image.
        assertThat(product.getImages()).singleElement().satisfies(image -> {
            assertThat(image.getStorageKey()).isEqualTo("demo/ring-gold-1.jpg#1-0");
            assertThat(image.getAlt().en()).isEqualTo("Leyla — gold engagement ring 585");
            assertThat(image.isAiGenerated()).isFalse();
        });
        assertThat(product.getStones()).singleElement().satisfies(stone -> {
            assertThat(stone.getCarat()).isEqualTo(new BigDecimal("0.100"));
            assertThat(stone.getCertificateLab()).isEqualTo("GIA");
        });
    }

    @Test
    @Transactional
    void everyDemoProductIsPublicAndCategoriesAreTranslated() {
        assertThat(products.findPublic(PageRequest.of(0, 100, Sort.by("id"))).getTotalElements()).isEqualTo(60);
        assertThat(categories.findByActiveTrueOrderBySortOrderAscIdAsc())
                .hasSize(12)
                .allSatisfy(category -> {
                    assertThat(category.getName().az()).isNotBlank();
                    assertThat(category.getName().en()).isNotBlank();
                    assertThat(category.getName().ru()).isNotBlank();
                });
        Category rings = categories.findBySlug("uzukler").orElseThrow();
        assertThat(categories.findByParentIdOrderBySortOrderAscIdAsc(rings.getId()))
                .extracting(Category::getSlug).containsExactly("nisan-uzukleri", "toy-uzukleri");
    }

    @Test
    void storesAreMarkedAsDemoData() {
        assertThat(jdbc.queryForList("SELECT whatsapp FROM stores ORDER BY id", String.class))
                .allMatch(phone -> phone.matches("\\+99450000000[1-6]"));
        assertThat(jdbc.queryForList("SELECT tax_id FROM stores ORDER BY id", String.class))
                .allMatch(taxId -> taxId.startsWith("000000000"));
        assertThat(jdbc.queryForList("SELECT description_az FROM products", String.class))
                .allMatch(text -> text.endsWith("Nümunə məhsul, real deyil."));
    }

    @Test
    void seedRunsOnceAndNewRowsGetFreshIds() throws IOException {
        String script = new ClassPathResource("db/demo/R__demo_seed.sql").getContentAsString(StandardCharsets.UTF_8);
        jdbc.execute(script);
        assertThat(count("products")).isEqualTo(60);
        assertThat(count("product_images")).isEqualTo(73);

        // Identity sequences continue after the explicit fixture ids.
        Long next = jdbc.queryForObject("""
                INSERT INTO categories (slug, name_az, name_en, name_ru) VALUES ('seed-test', 'Test', 'Test', 'Тест')
                RETURNING id
                """, Long.class);
        assertThat(next).isGreaterThan(12L);
        jdbc.update("DELETE FROM categories WHERE id = ?", next);
    }
}
