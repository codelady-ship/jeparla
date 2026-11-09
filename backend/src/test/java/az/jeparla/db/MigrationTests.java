package az.jeparla.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.support.PostgresContainerConfig;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Flyway migrations on a clean PostgreSQL 16 (#32): they apply, they are repeatable, and the
 * schema keeps the money, weight and integrity rules of CLAUDE.md and PLAN 5.2.
 */
@Testcontainers(disabledWithoutDocker = true)
class MigrationTests {

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer(PostgresContainerConfig.IMAGE);

    private static final AtomicInteger SEQ = new AtomicInteger();

    private static MigrateResult firstRun;
    private static Flyway flyway;
    private static JdbcTemplate jdbc;

    @BeforeAll
    static void migrate() {
        flyway = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .cleanDisabled(true)
                .load();
        firstRun = flyway.migrate();
        jdbc = new JdbcTemplate(new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
    }

    // ------------------------------------------------------------------ migrations

    @Test
    void migrationsApplyOnCleanDatabase() {
        assertThat(firstRun.success).isTrue();
        assertThat(firstRun.initialSchemaVersion).isNull();
        assertThat(firstRun.migrationsExecuted).isGreaterThanOrEqualTo(7);
        flyway.validate();
        assertThat(flyway.migrate().migrationsExecuted).as("second run is a no-op").isZero();
    }

    @Test
    void everyTableFromTheIssueExists() {
        List<String> tables = jdbc.queryForList(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'", String.class);
        assertThat(tables).contains(
                "users", "roles", "user_roles", "stores", "categories", "finenesses", "products",
                "product_images", "product_variants", "product_stones", "favorites", "product_reports",
                "audit_logs", "verification_documents", "metal_price_snapshots", "price_history",
                "refresh_tokens", "product_contact_clicks");
        assertThat(jdbc.queryForList("SELECT name FROM roles ORDER BY name", String.class))
                .containsExactly("ADMIN", "MERCHANT", "USER");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM pg_extension WHERE extname = 'pg_trgm'", Integer.class))
                .isOne();
    }

    // ------------------------------------------------------------------ column types

    @Test
    void noFloatingPointColumns() {
        List<Map<String, Object>> floats = jdbc.queryForList("""
                SELECT c.table_name, c.column_name, c.data_type, c.udt_name
                FROM information_schema.columns c
                JOIN information_schema.tables t
                  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
                WHERE c.table_schema = 'public'
                  AND t.table_name <> 'flyway_schema_history'
                  AND (c.data_type IN ('real', 'double precision')
                       OR c.udt_name IN ('float4', 'float8', '_float4', '_float8'))
                """);
        assertThat(floats).as("float/double columns are forbidden (CLAUDE.md)").isEmpty();
    }

    @Test
    void timestampsCarryTimeZone() {
        List<String> naive = jdbc.queryForList("""
                SELECT table_name || '.' || column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name <> 'flyway_schema_history'
                  AND data_type IN ('timestamp without time zone', 'time without time zone')
                """, String.class);
        assertThat(naive).isEmpty();
    }

    @ParameterizedTest
    @CsvSource({
            "product_variants, price, 12, 2",
            "product_variants, weight_grams, 8, 3",
            "product_variants, labor_per_gram, 12, 2",
            "product_variants, min_price, 12, 2",
            "product_stones, carat, 8, 3",
            "price_history, price, 12, 2",
            "metal_price_snapshots, price_per_gram, 14, 4",
    })
    void moneyAndWeightAreNumeric(String table, String column, int precision, int scale) {
        Map<String, Object> type = jdbc.queryForMap("""
                SELECT data_type, numeric_precision, numeric_scale
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
                """, table, column);
        assertThat(type).containsEntry("data_type", "numeric")
                .containsEntry("numeric_precision", precision)
                .containsEntry("numeric_scale", scale);
    }

    @Test
    void everyPriceHasACurrencyColumn() {
        for (String table : List.of("product_variants", "price_history", "metal_price_snapshots")) {
            Map<String, Object> type = jdbc.queryForMap("""
                    SELECT data_type, character_maximum_length
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = ? AND column_name = 'currency'
                    """, table);
            assertThat(type).as(table).containsEntry("data_type", "character")
                    .containsEntry("character_maximum_length", 3);
        }
    }

    @Test
    void everyForeignKeyStatesItsDeleteRule() {
        // information_schema reports NO ACTION when ON DELETE was left out.
        List<String> implicit = jdbc.queryForList("""
                SELECT tc.table_name || '.' || tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.referential_constraints rc
                  ON rc.constraint_schema = tc.constraint_schema AND rc.constraint_name = tc.constraint_name
                WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
                  AND rc.delete_rule = 'NO ACTION'
                """, String.class);
        assertThat(implicit).isEmpty();
    }

    // ------------------------------------------------------------------ constraints

    @Test
    void negativePriceAndWeightAreRejected() {
        long product = product(store(merchant()));
        long fineness = fineness();
        assertThatThrownBy(() -> variant(product, fineness, "NEG-1", "-0.01", "3.250"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("product_variants_price");
        assertThatThrownBy(() -> variant(product, fineness, "NEG-2", "100.00", "0.000"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("product_variants_weight");
    }

    @Test
    void skuIsUniqueWithinAStoreOnly() {
        long owner = merchant();
        long storeA = store(owner);
        long storeB = store(owner);
        long fineness = fineness();
        long productA1 = product(storeA);
        long productA2 = product(storeA);
        long productB = product(storeB);

        long first = variant(productA1, fineness, "RING-585", "1248.50", "3.250");
        assertThatThrownBy(() -> variant(productA2, fineness, "RING-585", "900.00", "2.000"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("product_variants_store_sku_key");
        variant(productB, fineness, "RING-585", "900.00", "2.000");

        // A removed variant frees its SKU.
        jdbc.update("UPDATE product_variants SET deleted_at = now() WHERE id = ?", first);
        variant(productA2, fineness, "RING-585", "900.00", "2.000");
    }

    @Test
    void variantStoreMustMatchItsProduct() {
        long owner = merchant();
        long product = product(store(owner));
        long otherStore = store(owner);
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO product_variants (product_id, store_id, sku, fineness_id, weight_grams, price)
                VALUES (?, ?, 'X-1', ?, 1.000, 1.00)
                """, product, otherStore, fineness()))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("product_variants_product_fk");
    }

    @Test
    void decimalsAreStoredExactly() {
        long variant = variant(product(store(merchant())), fineness(), "EXACT-1", "1248.50", "3.250");
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT price, weight_grams FROM product_variants WHERE id = ?", variant);
        assertThat(row.get("price")).isEqualTo(new BigDecimal("1248.50"));
        assertThat(row.get("weight_grams")).isEqualTo(new BigDecimal("3.250"));
    }

    @Test
    void productsAreNeverDeleted() {
        long product = product(store(merchant()));
        assertThatThrownBy(() -> jdbc.update("DELETE FROM products WHERE id = ?", product))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("never deleted");
        jdbc.update("UPDATE products SET status = 'INACTIVE', deleted_at = now() WHERE id = ?", product);
        assertThatThrownBy(() -> jdbc.update("UPDATE products SET status = 'DRAFT' WHERE id = ?", product))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("products_deleted_is_inactive");
    }

    @Test
    void slugsAreUnique() {
        long store = store(merchant());
        String slug = jdbc.queryForObject("SELECT slug FROM stores WHERE id = ?", String.class, store);
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO stores (owner_id, slug, name, city, address, whatsapp, legal_type, tax_id)
                VALUES (?, ?, 'Copy', 'Baku', 'Nizami 1', '+994501234567', 'COMPANY', '1234567890')
                """, merchant(), slug))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("stores_slug_key");
    }

    @Test
    void favoriteIsUniquePerUserAndProduct() {
        long buyer = user();
        long product = product(store(merchant()));
        jdbc.update("INSERT INTO favorites (user_id, product_id) VALUES (?, ?)", buyer, product);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO favorites (user_id, product_id) VALUES (?, ?)", buyer, product))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("favorites_user_product_key");

        // Deleting the account removes its favorites (ON DELETE CASCADE).
        jdbc.update("DELETE FROM users WHERE id = ?", buyer);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM favorites WHERE user_id = ?", Integer.class, buyer))
                .isZero();
    }

    @Test
    void ownerOfAStoreCannotBeDeleted() {
        long owner = merchant();
        store(owner);
        assertThatThrownBy(() -> jdbc.update("DELETE FROM users WHERE id = ?", owner))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void repricingFromTheSameQuoteIsWrittenOnce() {
        long variant = variant(product(store(merchant())), fineness(), "HIST-1", "500.00", "2.000");
        long snapshot = jdbc.queryForObject("""
                INSERT INTO metal_price_snapshots (metal, quote_date, price_per_ounce, price_per_gram, source)
                VALUES ('GOLD', DATE '2026-01-01' + CAST(? AS INTEGER), 4500.1234, 144.6844, 'CBAR')
                RETURNING id
                """, Long.class, SEQ.incrementAndGet());
        String insert = """
                INSERT INTO price_history (variant_id, price, currency, reason, metal_snapshot_id)
                VALUES (?, 510.00, 'AZN', 'METAL_PRICE', ?)
                """;
        jdbc.update(insert, variant, snapshot);
        assertThatThrownBy(() -> jdbc.update(insert, variant, snapshot))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("price_history_variant_snapshot_key");
    }

    // ------------------------------------------------------------------ search folding

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "Üzük              | uzuk",
            "Sırğa             | sirga",
            "QIZIL üzük, 585!  | qizil uzuk 585",
            "İnci boyunbağı    | inci boyunbagi",
            "Əl işi Çəngəl Şah | el isi cengel sah",
            "Кольцо Ёлка       | кольцо елка",
    })
    void foldMatchesTheFrontendNormalization(String input, String expected) {
        assertThat(jdbc.queryForObject("SELECT jeparla_fold(?)", String.class, input)).isEqualTo(expected);
    }

    @Test
    void productSearchColumnIsFolded() {
        long product = product(store(merchant()));
        jdbc.update("UPDATE products SET name_az = 'Qızıl üzük', name_ru = 'Золотое кольцо' WHERE id = ?", product);
        assertThat(jdbc.queryForObject("SELECT search_text FROM products WHERE id = ?", String.class, product))
                .isEqualTo("qizil uzuk золотое кольцо");

        // Typo-tolerant: "qizil uzk" is similar enough to "Qızıl üzük" for the trigram operator.
        jdbc.update("UPDATE products SET name_ru = NULL WHERE id = ?", product);
        assertThat(jdbc.queryForObject(
                "SELECT search_text % jeparla_fold('qizil uzk') FROM products WHERE id = ?",
                Boolean.class, product)).isTrue();
    }

    // ------------------------------------------------------------------ fixtures

    private static long user() {
        int n = SEQ.incrementAndGet();
        return jdbc.queryForObject("""
                INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Test user') RETURNING id
                """, Long.class, "user" + n + "@jeparla.test");
    }

    private static long merchant() {
        long id = user();
        jdbc.update("INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = 'MERCHANT'", id);
        return id;
    }

    private static long store(long owner) {
        int n = SEQ.incrementAndGet();
        return jdbc.queryForObject("""
                INSERT INTO stores (owner_id, slug, name, city, address, whatsapp, legal_type, tax_id)
                VALUES (?, ?, ?, 'Baku', 'Nizami 1', '+994501234567', 'COMPANY', '1234567890') RETURNING id
                """, Long.class, owner, "store-" + n, "Store " + n);
    }

    private static long category() {
        int n = SEQ.incrementAndGet();
        return jdbc.queryForObject("""
                INSERT INTO categories (slug, name_az, name_en, name_ru) VALUES (?, 'Üzük', 'Ring', 'Кольцо') RETURNING id
                """, Long.class, "uzuk-" + n);
    }

    private static long fineness() {
        int n = SEQ.incrementAndGet();
        return jdbc.queryForObject("""
                INSERT INTO finenesses (metal, value, label) VALUES ('GOLD', ?, ?) RETURNING id
                """, Long.class, n, "test " + n);
    }

    private static long product(long store) {
        int n = SEQ.incrementAndGet();
        return jdbc.queryForObject("""
                INSERT INTO products (store_id, category_id, slug, name_az, metal) VALUES (?, ?, ?, 'Qızıl üzük', 'GOLD')
                RETURNING id
                """, Long.class, store, category(), "product-" + n);
    }

    private static long variant(long product, long fineness, String sku, String price, String weight) {
        return jdbc.queryForObject("""
                INSERT INTO product_variants (product_id, store_id, sku, fineness_id, weight_grams, price)
                SELECT id, store_id, ?, ?, ?, ? FROM products WHERE id = ?
                RETURNING id
                """, Long.class, sku, fineness, new BigDecimal(weight), new BigDecimal(price), product);
    }
}
