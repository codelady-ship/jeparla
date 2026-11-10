package az.jeparla.support;

import az.jeparla.auth.User;
import az.jeparla.pricing.MetalPriceSnapshot;
import az.jeparla.pricing.PricingEngine;
import az.jeparla.pricing.QuoteSource;
import az.jeparla.product.Category;
import az.jeparla.product.Fineness;
import az.jeparla.product.Metal;
import az.jeparla.product.Product;
import az.jeparla.product.ProductVariant;
import az.jeparla.store.Store;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Data for {@link MetalPriceJobTest}: committed in its own transactions, removed by {@link #clean()}. */
@Component
public class MetalPriceJobTestSupport {

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final TestData data;
    private final EntityManager em;

    public MetalPriceJobTestSupport(JdbcTemplate jdbc, PlatformTransactionManager transactionManager, TestData data,
            EntityManager em) {
        this.jdbc = jdbc;
        this.tx = new TransactionTemplate(transactionManager);
        this.data = data;
        this.em = em;
    }

    /** Empty quotes, products (with variants and price history) and audit log; the job lock released. */
    public void clean() {
        MetalPriceJobTest.STUB.reset();
        jdbc.execute("TRUNCATE products, metal_price_snapshots, audit_logs CASCADE");
        // Release the job lock. The row stays: ShedLock remembers it inserted it and only updates it later.
        jdbc.update("UPDATE shedlock SET lock_until = now() - interval '1 second'");
    }

    /** An APPLIED quote, as if fetched before. */
    public long quote(Metal metal, String date, String ounce, QuoteSource source) {
        return tx.execute(status -> {
            MetalPriceSnapshot snapshot = new MetalPriceSnapshot(metal, LocalDate.parse(date), new BigDecimal(ounce),
                    PricingEngine.gramPrice(new BigDecimal(ounce)), source, Instant.parse(date + "T06:00:00Z"));
            em.persist(snapshot);
            return snapshot.getId();
        });
    }

    /** A real fineness value (585, 925 ...) of the metal, created once per value and metal. */
    private Fineness fineness(Metal metal, int value) {
        return em.createQuery("select f from Fineness f where f.metal = :metal and f.value = :value", Fineness.class)
                .setParameter("metal", metal).setParameter("value", (short) value)
                .getResultStream().findFirst()
                .orElseGet(() -> {
                    Fineness fineness = new Fineness(metal, value, metal + " " + value, value);
                    em.persist(fineness);
                    return fineness;
                });
    }

    /**
     * A product with one METAL_LINKED variant; its stored price is {@code price} (what the seller saw
     * before the new quote).
     */
    public long metalLinkedVariant(Metal metal, int finenessValue, String weight, String price, String laborPerGram,
            String laborFixed, String stone, String markup, String min, String max) {
        return tx.execute(status -> {
            User owner = data.merchant();
            Store store = data.approvedStore(owner);
            Category category = data.category();
            Product product = data.publicProduct(store, category, fineness(metal, finenessValue), price);
            ProductVariant variant = product.getVariants().getFirst();
            variant.setWeightGrams(new BigDecimal(weight));
            variant.setMetalLinkedRule(new BigDecimal(laborPerGram), new BigDecimal(laborFixed), new BigDecimal(stone),
                    new BigDecimal(markup), min == null ? null : new BigDecimal(min),
                    max == null ? null : new BigDecimal(max));
            em.flush();
            return variant.getId();
        });
    }

    /** A product with one FIXED variant. */
    public long fixedVariant(Metal metal, int finenessValue, String price) {
        return tx.execute(status -> {
            User owner = data.merchant();
            Product product = data.publicProduct(data.approvedStore(owner), data.category(),
                    fineness(metal, finenessValue), price);
            em.flush();
            return product.getVariants().getFirst().getId();
        });
    }

    public BigDecimal price(long variantId) {
        return jdbc.queryForObject("SELECT price FROM product_variants WHERE id = ?", BigDecimal.class, variantId);
    }

    public Long snapshotOf(long variantId) {
        return jdbc.queryForObject("SELECT metal_snapshot_id FROM product_variants WHERE id = ?", Long.class, variantId);
    }

    public long historyRows(long variantId) {
        return jdbc.queryForObject("SELECT count(*) FROM price_history WHERE variant_id = ?", Long.class, variantId);
    }

    public long count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Long.class, args);
    }

    public JdbcTemplate jdbc() {
        return jdbc;
    }
}
