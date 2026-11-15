package az.jeparla.product;

import static az.jeparla.product.ProductSpecifications.available;
import static az.jeparla.product.ProductSpecifications.documentsVerified;
import static az.jeparla.product.ProductSpecifications.hasLiveVariant;
import static az.jeparla.product.ProductSpecifications.inCategories;
import static az.jeparla.product.ProductSpecifications.inCity;
import static az.jeparla.product.ProductSpecifications.inStores;
import static az.jeparla.product.ProductSpecifications.isPublic;
import static az.jeparla.product.ProductSpecifications.matchingWords;
import static az.jeparla.product.ProductSpecifications.forAudience;
import static az.jeparla.product.ProductSpecifications.withHallmarkPhoto;
import static az.jeparla.product.ProductSpecifications.ofMaterialKind;
import static az.jeparla.product.ProductSpecifications.ofMetal;
import static az.jeparla.product.ProductSpecifications.withDiamond;
import static az.jeparla.product.ProductSpecifications.withFineness;
import static az.jeparla.product.ProductSpecifications.withIds;
import static az.jeparla.product.ProductSpecifications.withPriceFromBetween;
import static az.jeparla.product.ProductSpecifications.withWeightBetween;

import az.jeparla.common.dto.PageDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.i18n.SearchText;
import az.jeparla.product.dto.CategoryDto;
import az.jeparla.product.dto.CompareItemDto;
import az.jeparla.product.dto.FinenessDto;
import az.jeparla.product.dto.ProductDto;
import az.jeparla.product.dto.ProductQuery;
import az.jeparla.product.dto.ProductSummaryDto;
import az.jeparla.common.dto.LocalizedTextDto;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public catalog reads (#37): products, categories and finenesses for anonymous visitors.
 *
 * <p><b>Listed product</b> = APPROVED, not deleted, of an APPROVED store, in a visible category
 * ({@link CategoryTree}: the category and its ancestors are active) and with at least one live
 * variant (it needs a price). Nothing else is ever returned, counted or accepted by id.
 *
 * <p>Entities are mapped to DTOs inside the read-only transaction (open-in-view is off). A list costs
 * a fixed number of statements whatever the page size: categories, the page, the count, then stores,
 * images, variants, finenesses and stones in batches.
 */
@Service
@Transactional(readOnly = true)
public class ProductCatalogService {

    /** Words of {@code q} that are used; longer queries are cut. */
    static final int MAX_QUERY_WORDS = 8;

    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final CategoryRepository categories;
    private final FinenessRepository finenesses;
    private final CatalogMapper mapper;

    public ProductCatalogService(ProductRepository products, ProductVariantRepository variants,
            CategoryRepository categories, FinenessRepository finenesses, CatalogMapper mapper) {
        this.products = products;
        this.variants = variants;
        this.categories = categories;
        this.finenesses = finenesses;
        this.mapper = mapper;
    }

    // ------------------------------------------------------------------ products

    /** {@code GET /products} and {@code /stores/{slug}/products}. */
    public PageDto<ProductSummaryDto> list(ProductQuery query) {
        requireRange(query.minWeight(), query.maxWeight(), "maxWeight");
        requireRange(query.minPrice(), query.maxPrice(), "maxPrice");
        requireRange(query.minCarat(), query.maxCarat(), "maxCarat");
        int page = query.pageOrDefault();
        int size = query.sizeOrDefault();
        Optional<Specification<Product>> spec = specification(query, categoryTree());
        if (spec.isEmpty()) {
            return PageDto.empty(page, size);
        }
        Page<Product> result = products.findAllMatching(spec.get(), ProductOrder.of(query.sort()),
                PageRequest.of(page, size));
        return PageDto.of(result, mapper::summary);
    }

    /** {@code GET /products?ids=} (favorites): in the order asked; unknown or hidden ids are left out. */
    public List<ProductSummaryDto> byIds(List<Long> ids) {
        Map<Long, Product> listed = findListed(ids);
        // Null elements never reach Map.get: an immutable empty map throws on get(null) (#141).
        return ids.stream().filter(Objects::nonNull).map(listed::get).filter(Objects::nonNull).map(mapper::summary)
                .toList();
    }

    /** {@code GET /products/{slug}}: 404 unless the product is listed. */
    public ProductDto bySlug(String slug) {
        CategoryTree tree = categoryTree();
        return products.findPublicBySlug(slug)
                .filter(product -> tree.isVisible(product.getCategory().getId()) && !product.getVariants().isEmpty())
                .map(mapper::detail)
                .orElseThrow(ApiException::notFound);
    }

    /** {@code GET /variants?ids=} (compare): live variants of listed products, in the order asked. */
    public List<CompareItemDto> compare(List<Long> variantIds) {
        List<Long> distinct = variantIds.stream().filter(Objects::nonNull).distinct().toList();
        if (distinct.isEmpty()) {
            return List.of();
        }
        CategoryTree tree = categoryTree();
        Map<Long, ProductVariant> found = variants.findPublicLiveByIdIn(distinct).stream()
                .filter(variant -> tree.isVisible(variant.getProduct().getCategory().getId()))
                .collect(Collectors.toMap(ProductVariant::getId, Function.identity()));
        return variantIds.stream().map(found::get).filter(Objects::nonNull).map(mapper::compareItem).toList();
    }

    /** The listed product with this id, or 404 (reports, contact clicks). */
    public Product requireListed(long productId) {
        Product product = findListed(List.of(productId)).get(productId);
        if (product == null) {
            throw ApiException.notFound();
        }
        return product;
    }

    /** {@code [storeId -> listed product count]} for the store list and page. */
    public Map<Long, Long> listedCountsByStore() {
        Set<Long> visible = categoryTree().visibleIds();
        if (visible.isEmpty()) {
            return Map.of();
        }
        return toCounts(products.countListedByStore(visible));
    }

    /** Ids of the visible categories (active, with active ancestors): listed products are in one of them. */
    public Set<Long> visibleCategoryIds() {
        return categoryTree().visibleIds();
    }

    // ------------------------------------------------------------------ categories and finenesses

    /** {@code GET /categories}: visible categories by sort order, counts include subcategories. */
    public List<CategoryDto> categories() {
        CategoryTree tree = categoryTree();
        Map<Long, Long> totals = new HashMap<>();
        toCounts(products.countListedByCategory()).forEach((categoryId, count) -> {
            if (tree.isVisible(categoryId)) {
                tree.selfAndAncestorIds(categoryId).forEach(id -> totals.merge(id, count, Long::sum));
            }
        });
        return tree.visible().stream()
                .map(c -> new CategoryDto(c.getId(), c.getSlug(), CategoryTree.parentId(c), LocalizedTextDto.of(c.getName()),
                        totals.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    /** {@code GET /finenesses}: active finenesses in the admin order. */
    public List<FinenessDto> finenesses() {
        return finenesses.findByActiveTrueOrderBySortOrderAscIdAsc().stream().map(FinenessDto::of).toList();
    }

    // ------------------------------------------------------------------ internals

    private CategoryTree categoryTree() {
        return new CategoryTree(categories.findAll());
    }

    private Map<Long, Product> findListed(Collection<Long> ids) {
        List<Long> distinct = ids.stream().filter(Objects::nonNull).distinct().toList();
        Set<Long> visible = categoryTree().visibleIds();
        if (distinct.isEmpty() || visible.isEmpty()) {
            return Map.of();
        }
        Specification<Product> spec = isPublic().and(hasLiveVariant()).and(inCategories(visible)).and(withIds(distinct));
        return products.findAllMatching(spec, ProductOrder.RELEVANCE, PageRequest.of(0, distinct.size())).stream()
                .collect(Collectors.toMap(Product::getId, Function.identity()));
    }

    /** Filters of the query; empty when nothing can match (unknown or hidden category). */
    private static Optional<Specification<Product>> specification(ProductQuery query, CategoryTree tree) {
        Set<Long> categoryIds = tree.visibleIds();
        if (query.category() != null && !query.category().isBlank()) {
            Optional<Category> category = tree.visibleBySlug(query.category().strip());
            if (category.isEmpty()) {
                return Optional.empty();
            }
            categoryIds = tree.subtreeIds(category.get());
        }
        if (categoryIds.isEmpty()) {
            return Optional.empty();
        }
        Specification<Product> spec = isPublic().and(hasLiveVariant()).and(inCategories(categoryIds));
        if (notEmpty(query.store())) {
            spec = spec.and(inStores(query.store()));
        }
        if (query.kind() != null) {
            spec = spec.and(ofMaterialKind(query.kind()));
        }
        if (Boolean.TRUE.equals(query.hallmarkPhoto())) {
            spec = spec.and(withHallmarkPhoto());
        }
        if (query.audience() != null) {
            spec = spec.and(forAudience(query.audience()));
        }
        if (query.metal() != null) {
            spec = spec.and(ofMetal(query.metal()));
        }
        if (notEmpty(query.fineness())) {
            spec = spec.and(withFineness(query.fineness()));
        }
        if (query.minWeight() != null || query.maxWeight() != null) {
            spec = spec.and(withWeightBetween(query.minWeight(), query.maxWeight()));
        }
        if (query.minPrice() != null || query.maxPrice() != null) {
            spec = spec.and(withPriceFromBetween(query.minPrice(), query.maxPrice()));
        }
        if (Boolean.TRUE.equals(query.verified())) {
            spec = spec.and(documentsVerified());
        }
        if (Boolean.TRUE.equals(query.inStock())) {
            spec = spec.and(available());
        }
        if (query.city() != null && !query.city().isBlank()) {
            spec = spec.and(inCity(query.city().strip()));
        }
        if (notEmpty(query.shape()) || notEmpty(query.color()) || notEmpty(query.clarity())
                || query.minCarat() != null || query.maxCarat() != null) {
            spec = spec.and(withDiamond(query.shape(), query.minCarat(), query.maxCarat(), query.color(),
                    query.clarity()));
        }
        List<String> words = SearchText.words(query.q(), MAX_QUERY_WORDS);
        if (!words.isEmpty()) {
            spec = spec.and(matchingWords(words));
        }
        return Optional.of(spec);
    }

    private static void requireRange(BigDecimal min, BigDecimal max, String field) {
        if (min != null && max != null && min.compareTo(max) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "catalog.invalid_range", field);
        }
    }

    private static boolean notEmpty(Collection<?> values) {
        return values != null && !values.isEmpty();
    }

    private static Map<Long, Long> toCounts(List<Object[]> rows) {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : rows) {
            counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return counts;
    }
}
