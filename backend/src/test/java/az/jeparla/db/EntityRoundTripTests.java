package az.jeparla.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.admin.ActorRole;
import az.jeparla.admin.AuditLog;
import az.jeparla.admin.AuditLogRepository;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.auth.RoleName;
import az.jeparla.auth.User;
import az.jeparla.auth.UserRepository;
import az.jeparla.common.Currencies;
import az.jeparla.common.i18n.Language;
import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.pricing.MetalPriceSnapshot;
import az.jeparla.pricing.PriceChangeReason;
import az.jeparla.pricing.PriceHistory;
import az.jeparla.pricing.PriceHistoryRepository;
import az.jeparla.pricing.QuoteSource;
import az.jeparla.pricing.QuoteStatus;
import az.jeparla.product.Category;
import az.jeparla.product.Favorite;
import az.jeparla.product.FavoriteRepository;
import az.jeparla.product.Fineness;
import az.jeparla.product.Metal;
import az.jeparla.product.PricingMode;
import az.jeparla.product.Product;
import az.jeparla.product.ProductReport;
import az.jeparla.product.ProductRepository;
import az.jeparla.product.ProductStone;
import az.jeparla.product.ProductVariant;
import az.jeparla.product.ProductVariantRepository;
import az.jeparla.product.ReportReason;
import az.jeparla.product.ReportStatus;
import az.jeparla.product.StoneOrigin;
import az.jeparla.product.StoneType;
import az.jeparla.store.Store;
import az.jeparla.store.StoreRepository;
import az.jeparla.store.StoreStatus;
import az.jeparla.support.JpaTest;
import az.jeparla.support.TestData;
import az.jeparla.verification.CheckKind;
import az.jeparla.verification.CheckStatus;
import az.jeparla.verification.DocumentKind;
import az.jeparla.verification.DocumentStatus;
import az.jeparla.verification.VerificationDocument;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.net.InetAddress;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Every aggregate survives a save and a fresh load unchanged: decimals keep their scale
 * ({@code BigDecimal.equals} compares the scale), enums, currencies, localized text and
 * timestamps round-trip; database constraints surface as exceptions.
 */
@JpaTest
class EntityRoundTripTests {

    private static final Instant NOW = Instant.parse("2026-11-03T06:05:00Z");

    @Autowired
    private EntityManager em;

    @Autowired
    private TestData data;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private UserRepository users;

    @Autowired
    private StoreRepository stores;

    @Autowired
    private ProductRepository products;

    @Autowired
    private ProductVariantRepository variants;

    @Autowired
    private FavoriteRepository favorites;

    @Autowired
    private PriceHistoryRepository priceHistory;

    @Autowired
    private AuditLogRepository auditLogs;

    private <T> T reload(Class<T> type, Object id) {
        em.flush();
        em.clear();
        return em.find(type, id);
    }

    // ------------------------------------------------------------------ users and stores

    @Test
    void userWithRolesRoundTrips() {
        User user = data.merchant();
        user.setPreferredLocale(Language.RU);
        user.setPhone("+994501112233");

        User loaded = reload(User.class, user.getId());
        assertThat(loaded.getEmail()).isEqualTo(user.getEmail());
        assertThat(loaded.getPreferredLocale()).isEqualTo(Language.RU);
        assertThat(loaded.hasRole(RoleName.MERCHANT)).isTrue();
        assertThat(loaded.getCreatedAt()).isNotNull();
        assertThat(jdbc.queryForObject("SELECT preferred_locale FROM users WHERE id = ?", String.class, user.getId()))
                .isEqualTo("ru");

        assertThat(users.findByEmailIgnoringCase(user.getEmail().toUpperCase())).contains(loaded);
        assertThat(users.findByPhone("+994501112233")).contains(loaded);
    }

    @Test
    void emailIsUniqueRegardlessOfCase() {
        User first = data.buyer();
        em.flush();
        User copy = new User(first.getEmail().toUpperCase(), null, "x", "Copy");
        assertThatThrownBy(() -> users.saveAndFlush(copy))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("users_email_key");
    }

    @Test
    void storeRoundTripsWithGeneratedSearchTextAndTimestamps() {
        Store store = data.store(data.merchant());
        store.setGeo(new BigDecimal("40.409264"), new BigDecimal("49.867092"));
        store.setDescription(LocalizedText.of("Qızıl", "Gold", "Золото"));
        store.setSellerStatus(CheckStatus.VERIFIED);
        em.flush();
        Instant created = store.getCreatedAt();

        Store loaded = reload(Store.class, store.getId());
        assertThat(loaded.getLatitude()).isEqualTo(new BigDecimal("40.409264"));
        assertThat(loaded.getLongitude()).isEqualTo(new BigDecimal("49.867092"));
        assertThat(loaded.getDescription()).isEqualTo(LocalizedText.of("Qızıl", "Gold", "Золото"));
        assertThat(loaded.getSellerStatus()).isEqualTo(CheckStatus.VERIFIED);
        assertThat(loaded.getStatus()).isEqualTo(StoreStatus.PENDING);
        // Generated by PostgreSQL (jeparla_fold), read-only in the entity.
        assertThat(loaded.getSearchText()).isEqualTo(("store " + loaded.getName().substring(6) + " baki"));
        assertThat(loaded.getCreatedAt()).isEqualTo(created);

        Instant updatedBefore = loaded.getUpdatedAt();
        loaded.setCity("Gəncə");
        Store updated = reload(Store.class, store.getId());
        assertThat(updated.getUpdatedAt()).isAfterOrEqualTo(updatedBefore);
        assertThat(updated.getCreatedAt()).isEqualTo(created);
        assertThat(updated.getSearchText()).endsWith(" gence");
    }

    @Test
    void storeCoordinatesHaveTheColumnScale() {
        Store store = data.store(data.merchant());
        store.setGeo(new BigDecimal("40.4"), new BigDecimal("-49.8671"));
        assertThat(store.getLatitude()).isEqualTo(new BigDecimal("40.400000"));
        em.flush();

        Store loaded = reload(Store.class, store.getId());
        assertThat(loaded.getLatitude()).isEqualTo(store.getLatitude());
        assertThat(loaded.getLongitude()).isEqualTo(new BigDecimal("-49.867100"));
        assertThat(jdbc.queryForObject("SELECT latitude::text || ' ' || longitude::text FROM stores WHERE id = ?",
                String.class, store.getId())).isEqualTo("40.400000 -49.867100");

        // A map picker's 8 decimals are refused, not silently rounded to 40.409262 by PostgreSQL (#126).
        assertThatThrownBy(() -> loaded.setGeo(new BigDecimal("40.40926172"), new BigDecimal("49.867092")))
                .isInstanceOf(ArithmeticException.class);
        assertThat(loaded.getLatitude()).isEqualTo(new BigDecimal("40.400000"));
    }

    @Test
    void storeSlugIsUnique() {
        Store store = data.store(data.merchant());
        em.flush();
        Store copy = new Store(data.merchant(), store.getSlug(), "Copy", "Bakı", "Nizami 2", "+994500000008",
                store.getLegalType(), "1234567890");
        assertThatThrownBy(() -> stores.saveAndFlush(copy))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("stores_slug_key");
    }

    // ------------------------------------------------------------------ product aggregate

    @Test
    void productAggregateKeepsDecimalScale() {
        Store store = data.approvedStore(data.merchant());
        Fineness fineness = data.fineness(Metal.GOLD);
        Product product = data.publicProduct(store, data.category(), fineness, "1248.5");
        product.setDescription(LocalizedText.of("Təsvir", null, "Описание"));
        ProductVariant variant = product.getVariants().getFirst();
        variant.setMetalLinkedRule(new BigDecimal("12"), new BigDecimal("20.0"), new BigDecimal("650"),
                new BigDecimal("15"), new BigDecimal("100"), null);
        variant.setSize("17");
        ProductStone stone = new ProductStone(StoneType.DIAMOND, StoneOrigin.LAB_GROWN, new BigDecimal("0.5"), 3);
        stone.setGrading("ROUND", "D", "VS1", "EXCELLENT");
        stone.setCertificate("GIA", "1234567");
        product.addStone(stone);

        Product loaded = reload(Product.class, product.getId());
        assertThat(loaded.getName().az()).startsWith("Qızıl üzük");
        assertThat(loaded.getName().in(Language.EN)).as("falls back to az").isEqualTo(loaded.getName().az());
        assertThat(loaded.getDescription()).isEqualTo(LocalizedText.of("Təsvir", null, "Описание"));
        assertThat(loaded.getSearchText()).startsWith("qizil uzuk");
        assertThat(loaded.getPublishedAt()).isEqualTo(Instant.parse("2026-10-01T09:00:00Z"));
        assertThat(loaded.isPublic()).isTrue();

        ProductVariant v = loaded.getVariants().getFirst();
        assertThat(v.getPrice()).isEqualTo(new BigDecimal("1248.50"));
        assertThat(v.getWeightGrams()).isEqualTo(new BigDecimal("3.250"));
        assertThat(v.getCurrency()).isEqualTo(Currencies.AZN);
        assertThat(v.getPricingMode()).isEqualTo(PricingMode.METAL_LINKED);
        assertThat(v.getLaborPerGram()).isEqualTo(new BigDecimal("12.00"));
        assertThat(v.getLaborFixed()).isEqualTo(new BigDecimal("20.00"));
        assertThat(v.getStonePrice()).isEqualTo(new BigDecimal("650.00"));
        assertThat(v.getMarkupPercent()).isEqualTo(new BigDecimal("15.00"));
        assertThat(v.getMinPrice()).isEqualTo(new BigDecimal("100.00"));
        assertThat(v.getMaxPrice()).isNull();
        assertThat(v.getStoreId()).isEqualTo(store.getId());
        assertThat(v.getSize()).isEqualTo("17");
        assertThat(v.getPriceUpdatedAt()).isEqualTo(NOW);

        ProductStone s = loaded.getStones().getFirst();
        assertThat(s.getCarat()).isEqualTo(new BigDecimal("0.500"));
        assertThat(s.getStoneCount()).isEqualTo(3);
        assertThat(s.getOrigin()).isEqualTo(StoneOrigin.LAB_GROWN);
        assertThat(s.getCertificateNumber()).isEqualTo("1234567");

        assertThat(loaded.getImages()).singleElement().satisfies(image -> {
            assertThat(image.getWidth()).isEqualTo(800);
            assertThat(image.isAiGenerated()).isFalse();
        });

        assertThat(jdbc.queryForObject("SELECT price::text FROM product_variants WHERE id = ?", String.class, v.getId()))
                .isEqualTo("1248.50");
    }

    @Test
    void moreDecimalsThanTheColumnIsRejectedNotRounded() {
        Fineness fineness = data.fineness(Metal.SILVER);
        assertThatThrownBy(() -> new ProductVariant("X", fineness, new BigDecimal("1.0005"), BigDecimal.TEN,
                Currencies.AZN, NOW)).isInstanceOf(ArithmeticException.class);
        assertThatThrownBy(() -> new ProductVariant("X", fineness, BigDecimal.ONE, new BigDecimal("9.999"),
                Currencies.AZN, NOW)).isInstanceOf(ArithmeticException.class);
    }

    @Test
    void liveSkuIsUniquePerStore() {
        Store store = data.store(data.merchant());
        Category category = data.category();
        Fineness fineness = data.fineness(Metal.GOLD);
        Product first = data.product(store, category, fineness, "100.00");
        Product second = data.product(store, category, fineness, "200.00");
        em.flush();
        String sku = first.getVariants().getFirst().getSku();
        assertThat(variants.existsLiveSku(store.getId(), sku)).isTrue();

        ProductVariant duplicate = new ProductVariant(sku, fineness, BigDecimal.ONE, BigDecimal.TEN, Currencies.AZN, NOW);
        second.addVariant(duplicate);
        assertThatThrownBy(() -> em.flush())
                .rootCause().hasMessageContaining("product_variants_store_sku_key");
    }

    @Test
    void removedVariantFreesItsSkuAndLeavesTheCollection() {
        Store store = data.store(data.merchant());
        Fineness fineness = data.fineness(Metal.GOLD);
        Product product = data.product(store, data.category(), fineness, "100.00");
        ProductVariant extra = new ProductVariant("EXTRA-" + TestData.next(), fineness, BigDecimal.ONE, BigDecimal.TEN,
                Currencies.AZN, NOW);
        product.addVariant(extra);
        em.flush();

        product.removeVariant(extra, NOW);
        Product loaded = reload(Product.class, product.getId());
        assertThat(loaded.getVariants()).hasSize(1).noneMatch(v -> v.getId().equals(extra.getId()));
        assertThat(variants.findById(extra.getId())).get().satisfies(v -> assertThat(v.isDeleted()).isTrue());
        assertThat(variants.existsLiveSku(store.getId(), extra.getSku())).isFalse();
    }

    @Test
    void productSlugIsUnique() {
        Store store = data.store(data.merchant());
        Product product = data.product(store, data.category(), data.fineness(Metal.GOLD), "1.00");
        em.flush();
        Product copy = new Product(store, product.getCategory(), product.getSlug(), LocalizedText.of("Kopya", null, null),
                Metal.GOLD);
        assertThatThrownBy(() -> products.saveAndFlush(copy))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("products_slug_key");
    }

    @Test
    void productsAreNeverDeletedEvenThroughTheEntityManager() {
        Product product = data.product(data.store(data.merchant()), data.category(), data.fineness(Metal.GOLD), "1.00");
        em.flush();
        // ProductRepository has no delete method; a raw JPQL delete hits the database trigger.
        assertThatThrownBy(() -> em.createQuery("delete from Product p where p.id = :id")
                .setParameter("id", product.getId())
                .executeUpdate())
                .rootCause().hasMessageContaining("never deleted");
    }

    // ------------------------------------------------------------------ pricing

    @Test
    void quoteAndPriceHistoryRoundTrip() {
        MetalPriceSnapshot quote = new MetalPriceSnapshot(Metal.GOLD, LocalDate.of(2025, 1, 2).plusDays(TestData.next()),
                new BigDecimal("7000.00"), new BigDecimal("225.0552"), QuoteSource.CBAR, NOW);
        quote.hold(new BigDecimal("12.4"));
        em.persist(quote);
        Product product = data.product(data.store(data.merchant()), data.category(), data.fineness(Metal.GOLD), "500.00");
        ProductVariant variant = product.getVariants().getFirst();
        variant.applyMetalPrice(new BigDecimal("510.4"), quote, NOW);
        PriceHistory history = priceHistory.save(new PriceHistory(variant, new BigDecimal("510.4"),
                new BigDecimal("500"), Currencies.AZN, PriceChangeReason.METAL_PRICE, quote, null));

        MetalPriceSnapshot loadedQuote = reload(MetalPriceSnapshot.class, quote.getId());
        assertThat(loadedQuote.getPricePerOunce()).isEqualTo(new BigDecimal("7000.0000"));
        assertThat(loadedQuote.getPricePerGram()).isEqualTo(new BigDecimal("225.0552"));
        assertThat(loadedQuote.getChangePercent()).isEqualTo(new BigDecimal("12.40"));
        assertThat(loadedQuote.getStatus()).isEqualTo(QuoteStatus.HELD);
        assertThat(loadedQuote.getCurrency()).isEqualTo(Currencies.AZN);

        PriceHistory loaded = em.find(PriceHistory.class, history.getId());
        assertThat(loaded.getPrice()).isEqualTo(new BigDecimal("510.40"));
        assertThat(loaded.getPreviousPrice()).isEqualTo(new BigDecimal("500.00"));
        assertThat(loaded.getMetalSnapshot().getId()).isEqualTo(quote.getId());
        assertThat(priceHistory.existsByVariantIdAndMetalSnapshotIdAndReason(variant.getId(), quote.getId(),
                PriceChangeReason.METAL_PRICE)).isTrue();

        ProductVariant reloadedVariant = em.find(ProductVariant.class, variant.getId());
        assertThat(reloadedVariant.getPrice()).isEqualTo(new BigDecimal("510.40"));
        assertThat(reloadedVariant.getMetalSnapshot().getId()).isEqualTo(quote.getId());
    }

    @Test
    void quoteIsUniquePerMetalDayAndSource() {
        LocalDate day = LocalDate.of(2030, 1, 1).plusDays(TestData.next());
        em.persist(new MetalPriceSnapshot(Metal.SILVER, day, BigDecimal.TEN, BigDecimal.ONE, QuoteSource.CBAR, NOW));
        em.flush();
        // IDENTITY ids: the INSERT runs on persist.
        assertThatThrownBy(() -> em.persist(
                new MetalPriceSnapshot(Metal.SILVER, day, BigDecimal.TEN, BigDecimal.ONE, QuoteSource.CBAR, NOW)))
                .rootCause().hasMessageContaining("metal_price_snapshots_metal_date_source_key");
    }

    // ------------------------------------------------------------------ favorites, reports, documents, audit

    @Test
    void favoriteIsUniquePerUserAndProduct() {
        User buyer = data.buyer();
        Product product = data.product(data.store(data.merchant()), data.category(), data.fineness(Metal.GOLD), "1.00");
        favorites.save(new Favorite(buyer, product));
        em.flush();
        assertThat(favorites.existsByUserIdAndProductId(buyer.getId(), product.getId())).isTrue();

        assertThatThrownBy(() -> favorites.save(new Favorite(buyer, product)))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("favorites_user_product_key");
    }

    @Test
    void reportRoundTrips() {
        Product product = data.product(data.store(data.merchant()), data.category(), data.fineness(Metal.GOLD), "1.00");
        ProductReport report = new ProductReport(product, null, ReportReason.WRONG_PRICE, null);
        em.persist(report);
        User admin = data.buyer();
        report.close(ReportStatus.RESOLVED, "Fixed", admin, NOW);

        ProductReport loaded = reload(ProductReport.class, report.getId());
        assertThat(loaded.getMessage()).isEmpty();
        assertThat(loaded.getReporter()).isNull();
        assertThat(loaded.getStatus()).isEqualTo(ReportStatus.RESOLVED);
        assertThat(loaded.getResolvedAt()).isEqualTo(NOW);
    }

    @Test
    void verificationDocumentHasARandomUuid() {
        User owner = data.merchant();
        Store store = data.store(owner);
        VerificationDocument document = new VerificationDocument(store, null, CheckKind.DOCUMENTS, DocumentKind.TAX_ID,
                "private/" + TestData.next() + ".pdf", "voen.pdf", "application/pdf", 2048,
                "a".repeat(64), owner);
        em.persist(document);
        assertThat(document.getId()).isNotNull();

        VerificationDocument loaded = reload(VerificationDocument.class, document.getId());
        assertThat(loaded.getSha256()).isEqualTo("a".repeat(64));
        assertThat(loaded.getStatus()).isEqualTo(DocumentStatus.PENDING);
        assertThat(loaded.getCreatedAt()).isNotNull();
    }

    @Test
    void auditLogStoresJsonAndIpAddress() throws Exception {
        User admin = data.buyer();
        AuditLog entry = auditLogs.save(new AuditLog(admin, "admin@jeparla.test", ActorRole.ADMIN, "STORE_APPROVED",
                AuditTargetType.STORE, "42", "Store 42")
                .withContext("Documents checked", "{\"from\":\"PENDING\",\"to\":\"APPROVED\"}",
                        InetAddress.getByName("192.0.2.10")));

        AuditLog loaded = reload(AuditLog.class, entry.getId());
        assertThat(loaded.getIpAddress()).isEqualTo(InetAddress.getByName("192.0.2.10"));
        assertThat(loaded.getDetails()).contains("\"to\"").contains("APPROVED");
        assertThat(jdbc.queryForObject("SELECT details ->> 'from' FROM audit_logs WHERE id = ?", String.class,
                entry.getId())).isEqualTo("PENDING");
        assertThat(loaded.getActorRole()).isEqualTo(ActorRole.ADMIN);
    }
}
