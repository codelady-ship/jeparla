package az.jeparla.indexnow;

import az.jeparla.common.i18n.Language;
import az.jeparla.notification.SupportProperties;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * The public page URLs a set of committed changes touched (#62), in every language: {@code
 * <site>/<lang>/products/<slug>} and {@code <site>/<lang>/stores/<slug>}. A page counts when it is public now (new
 * or changed) or was public before the change (hidden, deleted, blocked: the engines should see it is gone). A
 * store that became public or stopped being public brings its products' pages along.
 */
@Component
public class CatalogUrls {

    private final NamedParameterJdbcTemplate jdbc;
    private final String siteUrl;

    public CatalogUrls(NamedParameterJdbcTemplate jdbc, SupportProperties site) {
        this.jdbc = jdbc;
        this.siteUrl = site.siteUrl();
    }

    /** Public origin of the site, e.g. {@code https://jeparla.az}. */
    public String siteUrl() {
        return siteUrl;
    }

    public List<String> of(Collection<CatalogChange> changes) {
        Set<Long> productIds = new LinkedHashSet<>();
        Set<Long> productsWerePublic = new LinkedHashSet<>();
        Set<Long> storeIds = new LinkedHashSet<>();
        Set<Long> storesWerePublic = new LinkedHashSet<>();
        Set<Long> storesWithProducts = new LinkedHashSet<>();
        for (CatalogChange change : changes) {
            if (change.kind() == CatalogChange.Kind.PRODUCT) {
                productIds.add(change.id());
                if (change.wasPublic()) {
                    productsWerePublic.add(change.id());
                }
            } else {
                storeIds.add(change.id());
                if (change.wasPublic()) {
                    storesWerePublic.add(change.id());
                }
                if (change.visibilityChanged()) {
                    storesWithProducts.add(change.id());
                }
            }
        }
        Set<String> paths = new LinkedHashSet<>();
        if (!productIds.isEmpty()) {
            jdbc.query("""
                    SELECT p.id, p.slug,
                           p.status = 'APPROVED' AND p.deleted_at IS NULL AND s.status = 'APPROVED' AS listed
                    FROM products p JOIN stores s ON s.id = p.store_id
                    WHERE p.id IN (:ids)
                    """, Map.of("ids", productIds), rs -> {
                        if (rs.getBoolean("listed") || productsWerePublic.contains(rs.getLong("id"))) {
                            paths.add("/products/" + rs.getString("slug"));
                        }
                    });
        }
        if (!storeIds.isEmpty()) {
            jdbc.query("SELECT id, slug, status = 'APPROVED' AS listed FROM stores WHERE id IN (:ids)",
                    Map.of("ids", storeIds), rs -> {
                        if (rs.getBoolean("listed") || storesWerePublic.contains(rs.getLong("id"))) {
                            paths.add("/stores/" + rs.getString("slug"));
                        }
                    });
        }
        if (!storesWithProducts.isEmpty()) {
            // Products the seller and the admin consider published; their pages follow the store.
            jdbc.query("""
                    SELECT slug FROM products
                    WHERE store_id IN (:ids) AND status = 'APPROVED' AND deleted_at IS NULL
                    """, Map.of("ids", storesWithProducts), rs -> {
                        paths.add("/products/" + rs.getString("slug"));
                    });
        }
        List<String> urls = new ArrayList<>(paths.size() * Language.values().length);
        for (String path : paths) {
            for (Language language : Language.values()) {
                // Slugs are [a-z0-9-] (V3, V5 CHECK constraints): nothing to encode.
                urls.add(siteUrl + "/" + language.code() + path);
            }
        }
        return urls;
    }
}
