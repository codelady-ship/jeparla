package az.jeparla.admin;

import az.jeparla.admin.dto.AdminCollectionDto;
import az.jeparla.admin.dto.CollectionOrderRequest;
import az.jeparla.admin.dto.CollectionRequest;
import az.jeparla.collection.OccasionCollection;
import az.jeparla.collection.OccasionCollectionRepository;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.product.ProductRepository;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Occasion collections the admin manages (#115): create, rename, reorder, hide. Nothing is deleted: a hidden
 * collection leaves the site and the seller form and keeps its tags, so showing it again restores the page.
 * Every write is audited ({@code CATALOG} target).
 */
@Service
@PreAuthorize("hasRole('ADMIN')")
public class AdminCollectionService {

    /** Gap between positions, so one collection can later go between two without renumbering. */
    static final int ORDER_STEP = 10;

    private final OccasionCollectionRepository collections;
    private final ProductRepository products;
    private final AuditService audit;

    public AdminCollectionService(OccasionCollectionRepository collections, ProductRepository products,
            AuditService audit) {
        this.collections = collections;
        this.products = products;
        this.audit = audit;
    }

    /** Every collection, hidden ones too, in the admin order. */
    @Transactional(readOnly = true)
    public List<AdminCollectionDto> list() {
        Map<Long, Long> counts = counts();
        return collections.findAllByOrderBySortOrderAscIdAsc().stream()
                .map(c -> AdminCollectionDto.of(c, counts.getOrDefault(c.getId(), 0L))).toList();
    }

    @Transactional
    public AdminCollectionDto create(CollectionRequest request) {
        if (collections.existsBySlug(request.slug())) {
            throw new ApiException(HttpStatus.CONFLICT, "admin.slug_taken", "slug");
        }
        int order = request.sortOrder() != null ? request.sortOrder()
                : collections.findAllByOrderBySortOrderAscIdAsc().stream()
                        .mapToInt(OccasionCollection::getSortOrder).max().orElse(0) + ORDER_STEP;
        OccasionCollection collection = new OccasionCollection(request.slug(), names(request), order);
        collection.setActive(request.active() == null || request.active());
        collections.saveAndFlush(collection);
        audit.record("COLLECTION_CREATED", AuditTargetType.CATALOG, collection.getId(), collection.getName().az(),
                null, AuditDetails.of("kind", "collection", "slug", collection.getSlug(),
                        "active", collection.isActive()));
        return dto(collection);
    }

    /** Replaces slug, names and visibility; omitted sortOrder and active keep their values. */
    @Transactional
    public AdminCollectionDto update(long id, CollectionRequest request) {
        OccasionCollection collection = collections.findById(id).orElseThrow(ApiException::notFound);
        if (!collection.getSlug().equals(request.slug()) && collections.existsBySlug(request.slug())) {
            throw new ApiException(HttpStatus.CONFLICT, "admin.slug_taken", "slug");
        }
        String fromSlug = collection.getSlug();
        String fromName = collection.getName().az();
        boolean fromActive = collection.isActive();
        collection.setSlug(request.slug());
        collection.setName(names(request));
        collection.setSortOrder(request.sortOrder() == null ? collection.getSortOrder() : request.sortOrder());
        collection.setActive(request.active() == null ? collection.isActive() : request.active());
        collections.flush();
        audit.record("COLLECTION_UPDATED", AuditTargetType.CATALOG, collection.getId(), collection.getName().az(),
                null, AuditDetails.of("kind", "collection", "fromSlug", fromSlug, "slug", collection.getSlug(),
                        "fromName", fromName, "fromActive", fromActive, "active", collection.isActive()));
        return dto(collection);
    }

    /**
     * Sets the order of every collection: positions 10, 20, 30 ... in the order given. The list names each
     * collection exactly once (400 {@code admin.collection_order}), so a stale admin page cannot drop one.
     */
    @Transactional
    public List<AdminCollectionDto> reorder(CollectionOrderRequest request) {
        Map<Long, OccasionCollection> byId = collections.findAll().stream()
                .collect(Collectors.toMap(OccasionCollection::getId, Function.identity()));
        Set<Long> given = new HashSet<>(request.ids());
        if (given.size() != request.ids().size() || !given.equals(byId.keySet())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.collection_order", "ids");
        }
        for (int i = 0; i < request.ids().size(); i++) {
            byId.get(request.ids().get(i)).setSortOrder((i + 1) * ORDER_STEP);
        }
        collections.flush();
        audit.record("COLLECTIONS_REORDERED", AuditTargetType.CATALOG, null, "collections", null,
                AuditDetails.of("kind", "collection", "ids", request.ids().toString()));
        return list();
    }

    private AdminCollectionDto dto(OccasionCollection collection) {
        return AdminCollectionDto.of(collection, counts().getOrDefault(collection.getId(), 0L));
    }

    private Map<Long, Long> counts() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : products.countLiveByCollection()) {
            counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return counts;
    }

    private static LocalizedText names(CollectionRequest request) {
        return LocalizedText.of(request.name().az().strip(), request.name().en().strip(), request.name().ru().strip());
    }
}
