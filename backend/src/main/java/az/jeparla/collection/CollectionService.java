package az.jeparla.collection;

import az.jeparla.collection.dto.CollectionDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.product.Product;
import az.jeparla.product.ProductCatalogService;
import az.jeparla.product.ProductRepository;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
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

    /** {@code GET /collections}: shown collections in the admin order, empty ones too (productCount 0). */
    @Transactional(readOnly = true)
    public List<CollectionDto> shown() {
        Set<Long> visible = catalog.visibleCategoryIds();
        Map<Long, Long> counts = new HashMap<>();
        if (!visible.isEmpty()) {
            for (Object[] row : products.countListedByCollection(visible)) {
                counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
            }
        }
        return collections.findByActiveTrueOrderBySortOrderAscIdAsc().stream()
                .map(c -> CollectionDto.of(c, counts.getOrDefault(c.getId(), 0L))).toList();
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
