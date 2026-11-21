package az.jeparla.collection;

import az.jeparla.collection.dto.CollectionDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.product.Product;
import az.jeparla.product.ProductCatalogService;
import az.jeparla.product.ProductRepository;
import az.jeparla.product.dto.ProductImageDto;
import az.jeparla.product.dto.ProductQuery;
import az.jeparla.product.dto.ProductSummaryDto;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Occasion collections for visitors and sellers (#115). Visitors see the shown collections with the number of
 * listed products in each; the products themselves come from the catalog filter
 * ({@code GET /products?collection=}), so a collection page never has rules of its own.
 */
@Service
public class CollectionService {

    private final OccasionCollectionRepository collections;
    private final ProductRepository products;
    private final ProductCatalogService catalog;

    public CollectionService(OccasionCollectionRepository collections, ProductRepository products,
            ProductCatalogService catalog) {
        this.collections = collections;
        this.products = products;
        this.catalog = catalog;
    }

    /** How many of the newest products of a collection are looked at for its cover photo. */
    static final int COVER_CANDIDATES = 12;

    /**
     * {@code GET /collections}: shown collections in the admin order, empty ones too (productCount 0, no cover).
     * The cover is the main photo of one of the collection's newest listed products, never an AI image: the first
     * whose photo file no earlier collection uses yet (URL without its fragment), else the first at all. The same
     * rule as the sample data (frontend mock), so the cards show real products, never stock pictures.
     */
    @Transactional(readOnly = true)
    public List<CollectionDto> shown() {
        Set<Long> visible = catalog.visibleCategoryIds();
        Map<Long, Long> counts = new HashMap<>();
        if (!visible.isEmpty()) {
            for (Object[] row : products.countListedByCollection(visible)) {
                counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
            }
        }
        Set<String> used = new HashSet<>();
        List<CollectionDto> out = new ArrayList<>();
        for (OccasionCollection c : collections.findByActiveTrueOrderBySortOrderAscIdAsc()) {
            long count = counts.getOrDefault(c.getId(), 0L);
            ProductImageDto cover = count == 0 ? null : cover(c.getSlug(), used);
            if (cover != null) {
                used.add(file(cover.url()));
            }
            out.add(CollectionDto.of(c, count, cover));
        }
        return out;
    }

    private ProductImageDto cover(String slug, Set<String> used) {
        List<ProductSummaryDto> newest = catalog.list(ProductQuery.newestInCollection(slug, COVER_CANDIDATES))
                .content();
        List<ProductImageDto> main = newest.stream().filter(p -> !p.images().isEmpty()).map(p -> p.images().get(0))
                .filter(i -> !i.aiGenerated()).toList();
        Predicate<ProductImageDto> fresh = i -> !used.contains(file(i.url()));
        return main.stream().filter(fresh).findFirst()
                // Several products can share one photo file: another real photo of these products, if any.
                .or(() -> newest.stream().flatMap(p -> p.images().stream()).filter(i -> !i.aiGenerated())
                        .filter(fresh).findFirst())
                .orElse(main.isEmpty() ? null : main.get(0));
    }

    private static String file(String url) {
        int hash = url.indexOf('#');
        return hash < 0 ? url : url.substring(0, hash);
    }

    /**
     * Sets the seller's occasion tags on their own product (the caller checked ownership). {@code null} keeps the
     * tags; otherwise every id must be a shown collection or one the product already has (400
     * {@code merchant.collection_unknown}). Tags of hidden collections are kept: the seller cannot see them in the
     * form, so leaving them out (or sending them back unchanged) does not remove them.
     *
     * @return whether the tags changed
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean tag(Product product, List<Long> collectionIds) {
        if (collectionIds == null) {
            return false;
        }
        Set<Long> wanted = new LinkedHashSet<>(collectionIds.stream().filter(Objects::nonNull).toList());
        List<OccasionCollection> found = collections.findAllById(wanted);
        Set<OccasionCollection> current = product.getCollections();
        if (found.size() != wanted.size() || found.stream().anyMatch(c -> !c.isActive() && !current.contains(c))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.collection_unknown", "collectionIds");
        }
        Set<OccasionCollection> next = new HashSet<>(found);
        product.getCollections().stream().filter(c -> !c.isActive()).forEach(next::add);
        boolean changed = !next.equals(product.getCollections());
        product.setCollections(next);
        return changed;
    }
}
