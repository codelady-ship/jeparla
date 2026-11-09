package az.jeparla.product;

import static az.jeparla.product.ProductSpecifications.inStock;
import static az.jeparla.product.ProductSpecifications.inStores;
import static az.jeparla.product.ProductSpecifications.isPublic;
import static az.jeparla.product.ProductSpecifications.ofMetal;
import static az.jeparla.product.ProductSpecifications.verifiedSeller;
import static az.jeparla.product.ProductSpecifications.withFineness;
import static az.jeparla.product.ProductSpecifications.withPriceBetween;
import static az.jeparla.product.ProductSpecifications.withWeightBetween;
import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.auth.User;
import az.jeparla.common.Currencies;
import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.store.Store;
import az.jeparla.store.StoreRepository;
import az.jeparla.store.StoreStatus;
import az.jeparla.support.JpaTest;
import az.jeparla.support.TestData;
import az.jeparla.verification.CheckStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

/** Public catalog, merchant and ownership queries; soft delete; no N+1 on the catalog listing. */
@JpaTest
class ProductRepositoryTests {

    private static final Instant NOW = Instant.parse("2026-11-03T06:05:00Z");

    @Autowired
    private EntityManager em;

    @Autowired
    private EntityManagerFactory emf;

    @Autowired
    private TestData data;

    @Autowired
    private ProductRepository products;

    @Autowired
    private ProductVariantRepository variants;

    @Autowired
    private StoreRepository stores;

    @Autowired
    private FavoriteRepository favorites;

    private void flushAndClear() {
        em.flush();
        em.clear();
    }

    // ------------------------------------------------------------------ soft delete

    @Test
    void softDeletedProductDisappearsFromEveryPublicQuery() {
        User owner = data.merchant();
        Store store = data.approvedStore(owner);
        Category category = data.category();
        Product product = data.publicProduct(store, category, data.fineness(Metal.GOLD), "100.00");
        User buyer = data.buyer();
        favorites.save(new Favorite(buyer, product));
        flushAndClear();

        assertThat(products.findPublicBySlug(product.getSlug())).isPresent();
        assertThat(products.findPublicByStoreSlug(store.getSlug(), PageRequest.of(0, 10))).hasSize(1);
        assertThat(products.findPublicByCategoryIds(List.of(category.getId()), PageRequest.of(0, 10))).hasSize(1);
        assertThat(favorites.findPublicByUserId(buyer.getId())).hasSize(1);

        Product loaded = products.findByIdAndStoreOwnerId(product.getId(), owner.getId()).orElseThrow();
        loaded.softDelete(NOW);
        flushAndClear();

        assertThat(products.findPublicBySlug(product.getSlug())).isEmpty();
        assertThat(products.findPublicByStoreSlug(store.getSlug(), PageRequest.of(0, 10))).isEmpty();
        assertThat(products.findPublicByCategoryIds(List.of(category.getId()), PageRequest.of(0, 10))).isEmpty();
        assertThat(products.findAllMatching(isPublic().and(inStores(List.of(store.getSlug()))), PageRequest.of(0, 10)))
                .isEmpty();
        assertThat(products.findByStoreId(store.getId(), PageRequest.of(0, 10))).as("merchant list").isEmpty();
        assertThat(favorites.findPublicByUserId(buyer.getId())).isEmpty();

        // The row stays: INACTIVE with deleted_at.
        Product deleted = products.findById(product.getId()).orElseThrow();
        assertThat(deleted.getStatus()).isEqualTo(ProductStatus.INACTIVE);
        assertThat(deleted.getDeletedAt()).isEqualTo(NOW);
    }

    @Test
    void onlyApprovedProductsOfApprovedStoresArePublic() {
        Category category = data.category();
        Fineness fineness = data.fineness(Metal.GOLD);
        Store approved = data.approvedStore(data.merchant());
        Product draft = data.product(approved, category, fineness, "1.00");
        Product inReview = data.product(approved, category, fineness, "1.00");
        inReview.submitForReview(NOW);
        Product visible = data.publicProduct(approved, category, fineness, "1.00");
        Store blocked = data.approvedStore(data.merchant());
        Product ofBlockedStore = data.publicProduct(blocked, category, fineness, "1.00");
        blocked.setStatus(StoreStatus.BLOCKED);
        flushAndClear();

        assertThat(products.findPublicByCategoryIds(List.of(category.getId()), PageRequest.of(0, 10)))
                .extracting(Product::getId).containsExactly(visible.getId());
        assertThat(products.findPublicBySlug(draft.getSlug())).isEmpty();
        assertThat(products.findPublicBySlug(ofBlockedStore.getSlug())).isEmpty();
        assertThat(stores.findPublicBySlug(blocked.getSlug())).isEmpty();
        assertThat(stores.findPublicBySlug(approved.getSlug())).isPresent();

        Map<ProductStatus, Long> counts = products.countByStatusForStore(approved.getId()).stream()
                .collect(Collectors.toMap(row -> (ProductStatus) row[0], row -> (Long) row[1]));
        assertThat(counts).containsOnly(Map.entry(ProductStatus.DRAFT, 1L), Map.entry(ProductStatus.IN_REVIEW, 1L),
                Map.entry(ProductStatus.APPROVED, 1L));
    }

    // ------------------------------------------------------------------ ownership

    @Test
    void ownershipQueriesReturnNothingForAnotherMerchant() {
        User owner = data.merchant();
        User stranger = data.merchant();
        Store store = data.store(owner);
        Product product = data.product(store, data.category(), data.fineness(Metal.GOLD), "1.00");
        flushAndClear();
        Long variantId = product.getVariants().getFirst().getId();

        assertThat(products.findByIdAndStoreOwnerId(product.getId(), owner.getId())).isPresent();
        assertThat(products.findByIdAndStoreOwnerId(product.getId(), stranger.getId())).isEmpty();
        assertThat(products.existsByIdAndStoreOwnerId(product.getId(), stranger.getId())).isFalse();
        assertThat(stores.findByIdAndOwnerId(store.getId(), owner.getId())).isPresent();
        assertThat(stores.findByIdAndOwnerId(store.getId(), stranger.getId())).isEmpty();
        assertThat(stores.existsByIdAndOwnerId(store.getId(), stranger.getId())).isFalse();
        assertThat(variants.findLiveByIdAndOwnerId(variantId, owner.getId())).isPresent();
        assertThat(variants.findLiveByIdAndOwnerId(variantId, stranger.getId())).isEmpty();
        assertThat(stores.findByOwnerIdOrderByCreatedAtAsc(owner.getId())).extracting(Store::getId)
                .containsExactly(store.getId());
    }

    // ------------------------------------------------------------------ filters

    @Test
    void specificationsCombine() {
        Store store = data.approvedStore(data.merchant());
        store.setSellerStatus(CheckStatus.VERIFIED);
        Category category = data.category();
        Fineness gold = data.fineness(Metal.GOLD);
        Fineness silver = data.fineness(Metal.SILVER);
        Product cheapGold = data.publicProduct(store, category, gold, "300.00");
        Product dearGold = data.publicProduct(store, category, gold, "1500.00");
        Product silverRing = data.publicProduct(store, category, silver, "80.00");
        silverRing.getVariants().getFirst().setStockStatus(StockStatus.OUT_OF_STOCK);
        silverRing.getVariants().getFirst().setWeightGrams(new BigDecimal("7.5"));
        flushAndClear();

        var inStore = isPublic().and(inStores(List.of(store.getSlug())));
        PageRequest page = PageRequest.of(0, 10, Sort.by("id"));
        assertThat(ids(products.findAllMatching(inStore, page)))
                .containsExactly(cheapGold.getId(), dearGold.getId(), silverRing.getId());
        assertThat(ids(products.findAllMatching(inStore.and(ofMetal(Metal.GOLD)), page)))
                .containsExactly(cheapGold.getId(), dearGold.getId());
        assertThat(ids(products.findAllMatching(inStore.and(withFineness(List.of(silver.getValue()))), page)))
                .containsExactly(silverRing.getId());
        assertThat(ids(products.findAllMatching(
                inStore.and(withPriceBetween(new BigDecimal("100"), new BigDecimal("1200"))), page)))
                .containsExactly(cheapGold.getId());
        assertThat(ids(products.findAllMatching(inStore.and(withPriceBetween(null, new BigDecimal("300.00"))), page)))
                .containsExactly(cheapGold.getId(), silverRing.getId());
        assertThat(ids(products.findAllMatching(inStore.and(withWeightBetween(new BigDecimal("5"), null)), page)))
                .containsExactly(silverRing.getId());
        assertThat(ids(products.findAllMatching(inStore.and(inStock()), page)))
                .containsExactly(cheapGold.getId(), dearGold.getId());
        assertThat(ids(products.findAllMatching(inStore.and(verifiedSeller()), page))).hasSize(3);
    }

    @Test
    void cheapestVariantIsThePriceFrom() {
        Store store = data.store(data.merchant());
        Fineness fineness = data.fineness(Metal.GOLD);
        Product product = data.product(store, data.category(), fineness, "900.00");
        product.addVariant(new ProductVariant("CHEAP-" + TestData.next(), fineness, BigDecimal.ONE,
                new BigDecimal("450.00"), Currencies.AZN, NOW));
        flushAndClear();

        Product loaded = products.findById(product.getId()).orElseThrow();
        assertThat(loaded.cheapestVariant()).get().extracting(ProductVariant::getPrice)
                .isEqualTo(new BigDecimal("450.00"));
    }

    // ------------------------------------------------------------------ N+1

    @Test
    void catalogPageCostsAFixedNumberOfStatements() {
        Store store = data.approvedStore(data.merchant());
        Fineness fineness = data.fineness(Metal.GOLD);
        for (int i = 0; i < 24; i++) {
            Product product = data.publicProduct(store, data.category(), fineness, "100.00");
            product.addImage(new ProductImage("test/extra-" + TestData.next() + ".jpg", 800, 1000, "image/jpeg", 1,
                    false, 1));
            product.addStone(new ProductStone(StoneType.DIAMOND, StoneOrigin.NATURAL, new BigDecimal("0.25"), 1));
        }
        flushAndClear();

        long small = statements(() -> products.findPublicByStoreSlug(store.getSlug(), PageRequest.of(0, 3)));
        long large = statements(() -> products.findPublicByStoreSlug(store.getSlug(), PageRequest.of(0, 24)));
        // page + count + images + variants + finenesses + stones
        assertThat(large).isEqualTo(small).isLessThanOrEqualTo(6);

        var spec = isPublic().and(inStores(List.of(store.getSlug())));
        long smallSpec = statements(() -> products.findAllMatching(spec, PageRequest.of(0, 3)));
        long largeSpec = statements(() -> products.findAllMatching(spec, PageRequest.of(0, 24)));
        // + stores and categories, also in batches
        assertThat(largeSpec).isEqualTo(smallSpec).isLessThanOrEqualTo(8);
    }

    /** Loads a page, touches everything a catalog card shows, and counts the SQL statements. */
    private long statements(Supplier<Page<Product>> query) {
        em.clear();
        Statistics stats = emf.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        Page<Product> page = query.get();
        for (Product product : page) {
            LocalizedText name = product.getName();
            assertThat(name.az()).isNotBlank();
            assertThat(product.getStore().getName()).isNotBlank();
            assertThat(product.getCategory().getName().en()).isNotBlank();
            assertThat(product.getImages()).allSatisfy(image -> assertThat(image.getStorageKey()).isNotBlank());
            assertThat(product.getVariants()).allSatisfy(variant -> {
                assertThat(variant.getPrice()).isPositive();
                assertThat(variant.getFineness().getValue()).isPositive();
            });
            assertThat(product.getStones()).hasSize(1);
        }
        return stats.getPrepareStatementCount();
    }

    private static List<Long> ids(Page<Product> page) {
        return page.map(Product::getId).getContent();
    }
}
