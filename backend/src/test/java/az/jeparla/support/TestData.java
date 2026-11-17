package az.jeparla.support;

import az.jeparla.auth.Role;
import az.jeparla.auth.RoleName;
import az.jeparla.auth.RoleRepository;
import az.jeparla.auth.User;
import az.jeparla.common.Currencies;
import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.product.Category;
import az.jeparla.product.Fineness;
import az.jeparla.product.Metal;
import az.jeparla.product.Product;
import az.jeparla.product.ProductImage;
import az.jeparla.product.ProductVariant;
import az.jeparla.store.LegalType;
import az.jeparla.store.Store;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

/**
 * Persists small, unique test fixtures through JPA. Every slug, email and SKU gets a counter
 * suffix, so tests sharing one database never collide.
 */
@Component
public class TestData {

    private static final AtomicInteger SEQ = new AtomicInteger();

    private final EntityManager em;
    private final RoleRepository roles;

    public TestData(EntityManager em, RoleRepository roles) {
        this.em = em;
        this.roles = roles;
    }

    public static int next() {
        return SEQ.incrementAndGet();
    }

    public User merchant() {
        int n = next();
        User user = new User("merchant" + n + "@jeparla.test", null, "x", "Merchant " + n);
        Role role = roles.findByName(RoleName.MERCHANT).orElseThrow();
        user.addRole(role);
        em.persist(user);
        return user;
    }

    public User buyer() {
        int n = next();
        User user = new User("buyer" + n + "@jeparla.test", null, "x", "Buyer " + n);
        em.persist(user);
        return user;
    }

    public Store approvedStore(User owner) {
        Store store = store(owner);
        store.approve(Instant.parse("2026-09-01T05:00:00Z"));
        return store;
    }

    public Store store(User owner) {
        int n = next();
        Store store = new Store(owner, "store-" + n, "Store " + n, "Bakı", "Nizami 1", "+994500000009",
                LegalType.COMPANY, "1234567890");
        em.persist(store);
        return store;
    }

    public Category category() {
        int n = next();
        Category category = new Category(null, "category-" + n, LocalizedText.of("Üzük", "Ring", "Кольцо"), n);
        em.persist(category);
        return category;
    }

    public Fineness fineness(Metal metal) {
        int n = next();
        // A value within 1..1000 that no row of the metal has yet: the reference finenesses of V61
        // (375, 585, 925 ...) are in every database, so the counter skips them.
        while (taken(metal, 1 + n % 999)) {
            n = next();
        }
        Fineness fineness = new Fineness(metal, 1 + n % 999, "test " + n, n);
        em.persist(fineness);
        return fineness;
    }

    private boolean taken(Metal metal, int value) {
        return em.createQuery("select count(f) from Fineness f where f.metal = :metal and f.value = :value", Long.class)
                .setParameter("metal", metal).setParameter("value", (short) value)
                .getSingleResult() > 0;
    }

    /** An APPROVED product with one image and one variant priced {@code price}. */
    public Product publicProduct(Store store, Category category, Fineness fineness, String price) {
        Product product = product(store, category, fineness, price);
        product.approve(Instant.parse("2026-10-01T09:00:00Z"));
        return product;
    }

    /** A DRAFT product with one image and one variant priced {@code price}. */
    public Product product(Store store, Category category, Fineness fineness, String price) {
        int n = next();
        Product product = new Product(store, category, "product-" + n, LocalizedText.of("Qızıl üzük " + n, null, null),
                fineness.getMetal());
        ProductImage image = new ProductImage("test/product-" + n + ".jpg", 800, 1000, "image/jpeg", 1024, false, 0);
        product.addImage(image);
        product.addVariant(new ProductVariant("SKU-" + n, fineness, new BigDecimal("3.250"), new BigDecimal(price),
                Currencies.AZN, Instant.parse("2026-11-03T06:05:00Z")));
        em.persist(product);
        return product;
    }
}
