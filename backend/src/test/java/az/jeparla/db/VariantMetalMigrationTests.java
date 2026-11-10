package az.jeparla.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.support.PostgresContainerConfig;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * V10 (#122) on a database that already has variants: the metal column is backfilled from the
 * fineness, and variants that already disagree with their product stop the migration by id.
 * Each test gets its own database in one container, migrated to V9 first.
 */
@Testcontainers(disabledWithoutDocker = true)
class VariantMetalMigrationTests {

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer(PostgresContainerConfig.IMAGE);

    @Test
    void existingVariantsAreBackfilledFromTheirFineness() {
        Database db = databaseAtV9("backfill_ok");
        long gold = db.fineness("GOLD", 585);
        long silver = db.fineness("SILVER", 925);
        long store = db.store();
        long goldProduct = db.product(store, "GOLD", "gold-ring");
        long silverProduct = db.product(store, "SILVER", "silver-ring");
        long goldVariant = db.variant(goldProduct, gold, "G-1");
        long silverVariant = db.variant(silverProduct, silver, "S-1");

        assertThat(db.flyway.migrate().success).isTrue();

        assertThat(db.jdbc.queryForList("SELECT metal FROM product_variants WHERE id IN (?, ?) ORDER BY id",
                String.class, goldVariant, silverVariant)).containsExactly("GOLD", "SILVER");
        // V13 (#128): existing products and variants are PRECIOUS, whose CHECK keeps metal required; only
        // FASHION variants have none, so the column itself is nullable since then.
        assertThat(db.jdbc.queryForList("SELECT material_kind FROM product_variants WHERE id IN (?, ?)",
                String.class, goldVariant, silverVariant)).containsOnly("PRECIOUS");
        assertThat(db.jdbc.queryForList("SELECT material_kind FROM products WHERE id IN (?, ?)",
                String.class, goldProduct, silverProduct)).containsOnly("PRECIOUS");
        assertThatThrownBy(() -> db.jdbc.update("UPDATE product_variants SET fineness_id = NULL WHERE id = ?",
                goldVariant)).hasMessageContaining("product_variants_by_kind");
    }

    @Test
    void mismatchedVariantsStopTheMigrationWithTheirIds() {
        Database db = databaseAtV9("backfill_mismatch");
        long silver = db.fineness("SILVER", 925);
        long goldProduct = db.product(db.store(), "GOLD", "gold-ring");
        long wrong = db.variant(goldProduct, silver, "WRONG-1");

        assertThatThrownBy(db.flyway::migrate)
                .isInstanceOf(FlywayException.class)
                .hasMessageContaining("fineness metal differs from the product metal: " + wrong);
        // PostgreSQL DDL is transactional: nothing of V10 is left behind.
        assertThat(db.jdbc.queryForList("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'product_variants' AND column_name = 'metal'
                """, String.class)).isEmpty();
    }

    // ------------------------------------------------------------------ fixtures

    private static Database databaseAtV9(String name) {
        new JdbcTemplate(dataSource(POSTGRES.getJdbcUrl())).execute("CREATE DATABASE " + name);
        String url = POSTGRES.getJdbcUrl().replaceFirst("/[^/?]+(\\?|$)", "/" + name + "$1");
        DriverManagerDataSource dataSource = dataSource(url);
        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .target(MigrationVersion.fromVersion("9"))
                .load()
                .migrate();
        Flyway toLatest = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .cleanDisabled(true)
                .load();
        return new Database(toLatest, new JdbcTemplate(dataSource));
    }

    private static DriverManagerDataSource dataSource(String url) {
        return new DriverManagerDataSource(url, POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private record Database(Flyway flyway, JdbcTemplate jdbc) {

        long fineness(String metal, int value) {
            return jdbc.queryForObject("INSERT INTO finenesses (metal, value, label) VALUES (?, ?, ?) RETURNING id",
                    Long.class, metal, value, String.valueOf(value));
        }

        long store() {
            long owner = jdbc.queryForObject("""
                    INSERT INTO users (email, password_hash, display_name)
                    VALUES ('owner@jeparla.test', 'x', 'Owner') RETURNING id
                    """, Long.class);
            return jdbc.queryForObject("""
                    INSERT INTO stores (owner_id, slug, name, city, address, whatsapp, legal_type, tax_id)
                    VALUES (?, 'store', 'Store', 'Baku', 'Nizami 1', '+994501234567', 'COMPANY', '1234567890')
                    RETURNING id
                    """, Long.class, owner);
        }

        long product(long store, String metal, String slug) {
            long category = jdbc.queryForObject("""
                    INSERT INTO categories (slug, name_az, name_en, name_ru)
                    VALUES (?, 'Üzük', 'Ring', 'Кольцо') RETURNING id
                    """, Long.class, "category-" + slug);
            return jdbc.queryForObject("""
                    INSERT INTO products (store_id, category_id, slug, name_az, metal)
                    VALUES (?, ?, ?, 'Test üzük', ?) RETURNING id
                    """, Long.class, store, category, slug, metal);
        }

        long variant(long product, long fineness, String sku) {
            return jdbc.queryForObject("""
                    INSERT INTO product_variants (product_id, store_id, sku, fineness_id, weight_grams, price)
                    SELECT id, store_id, ?, ?, 2.000, 100.00 FROM products WHERE id = ?
                    RETURNING id
                    """, Long.class, sku, fineness, product);
        }
    }
}
