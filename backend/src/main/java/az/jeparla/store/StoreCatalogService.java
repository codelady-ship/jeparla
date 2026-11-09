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
import java.util.List;
import java.util.Map;
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
        List<String> words = SearchText.words(q, MAX_QUERY_WORDS);
        String cityFilter = city == null || city.isBlank() ? null : city.strip();
        Map<Long, Long> counts = products.listedCountsByStore();
        return stores.findAllPublic().stream()
                .filter(store -> cityFilter == null || cityFilter.equals(store.getCity()))
                .filter(store -> SearchText.matches(SearchText.fold(store.getName() + " " + store.getCity()), words))
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
