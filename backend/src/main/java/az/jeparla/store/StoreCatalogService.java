package az.jeparla.store;

import az.jeparla.common.dto.PageDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.i18n.SearchText;
import az.jeparla.common.storage.ImageUrls;
import az.jeparla.product.ProductCatalogService;
import az.jeparla.product.dto.ProductQuery;
import az.jeparla.product.dto.ProductSummaryDto;
import az.jeparla.store.dto.StoreDto;
import az.jeparla.store.dto.StoreDtos;
import az.jeparla.store.dto.StoreSummaryDto;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public store reads (#37): only APPROVED stores. {@code productCount} counts the listed products
 * (see {@link ProductCatalogService}).
 */
@Service
@Transactional(readOnly = true)
public class StoreCatalogService {

    private static final int MAX_QUERY_WORDS = 8;

    private final StoreRepository stores;
    private final ProductCatalogService products;
    private final ImageUrls imageUrls;

    public StoreCatalogService(StoreRepository stores, ProductCatalogService products, ImageUrls imageUrls) {
        this.stores = stores;
        this.products = products;
        this.imageUrls = imageUrls;
    }

    /**
     * {@code GET /stores}: every public store, oldest first, optionally of one city (exact) and
     * matching the words of {@code q} (each word starts a word of the name or city, Azerbaijani letters
     * folded), like the frontend mock. Not paged: the store list is short.
     */
    public List<StoreSummaryDto> list(String q, String city) {
        return list(q, city, null);
    }

    /**
     * {@link #list(String, String)} nearest first when {@code near} is given (#116): stores with coordinates by
     * their distance (ties: oldest first) with {@code distanceKm}, then the stores without coordinates in the
     * usual order. The buyer's point is used for this answer only: not stored, not logged, not cached.
     */
    public List<StoreSummaryDto> list(String q, String city, GeoPoint near) {
        List<String> words = SearchText.words(q, MAX_QUERY_WORDS);
        String cityFilter = city == null || city.isBlank() ? null : city.strip();
        Map<Long, Long> counts = products.listedCountsByStore();
        List<Store> found = stores.findAllPublic().stream()
                .filter(store -> cityFilter == null || cityFilter.equals(store.getCity()))
                .filter(store -> SearchText.matches(SearchText.fold(store.getName() + " " + store.getCity()), words))
                .toList();
        if (near == null) {
            return found.stream().map(store -> StoreDtos.summary(store, imageUrls.url(store.getLogoKey()),
                    counts.getOrDefault(store.getId(), 0L))).toList();
        }
        Map<Long, BigDecimal> distances = new HashMap<>();
        for (Store store : found) {
            if (store.getLatitude() != null && store.getLongitude() != null) {
                distances.put(store.getId(), near.distanceKm(new GeoPoint(store.getLatitude(), store.getLongitude())));
            }
        }
        Comparator<Store> nearest = Comparator.comparing((Store store) -> !distances.containsKey(store.getId()))
                .thenComparing(store -> distances.getOrDefault(store.getId(), BigDecimal.ZERO));
        return found.stream().sorted(nearest)
                .map(store -> StoreDtos.summary(store, imageUrls.url(store.getLogoKey()),
                        counts.getOrDefault(store.getId(), 0L), distances.get(store.getId())))
                .toList();
    }

    /** Store cards of these ids in the order given (search results); unknown and not APPROVED ids are left out. */
    public List<StoreSummaryDto> summaries(List<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Long, Long> counts = products.listedCountsByStore();
        Map<Long, Store> byId = stores.findAllById(ids).stream()
                .filter(store -> store.getStatus() == StoreStatus.APPROVED)
                .collect(Collectors.toMap(Store::getId, Function.identity()));
        return ids.stream().map(byId::get).filter(Objects::nonNull)
                .map(store -> StoreDtos.summary(store, imageUrls.url(store.getLogoKey()),
                        counts.getOrDefault(store.getId(), 0L)))
                .toList();
    }

    /** {@code GET /stores/{slug}}: 404 unless the store is APPROVED. */
    public StoreDto bySlug(String slug) {
        Store store = requirePublic(slug);
        long count = products.listedCountsByStore().getOrDefault(store.getId(), 0L);
        return StoreDtos.detail(store, imageUrls.url(store.getLogoKey()), count);
    }

    /** {@code GET /stores/{slug}/products}: the catalog query limited to this store; 404 for a hidden store. */
    public PageDto<ProductSummaryDto> products(String slug, ProductQuery query) {
        requirePublic(slug);
        return products.list(query.inStore(slug));
    }

    private Store requirePublic(String slug) {
        return stores.findPublicBySlug(slug).orElseThrow(ApiException::notFound);
    }
}
