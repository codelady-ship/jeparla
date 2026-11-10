package az.jeparla.admin;

import az.jeparla.admin.dto.AdminCategoryDto;
import az.jeparla.admin.dto.AdminFinenessDto;
import az.jeparla.admin.dto.AdminSynonymDto;
import az.jeparla.admin.dto.CategoryRequest;
import az.jeparla.admin.dto.FinenessRequest;
import az.jeparla.admin.dto.SynonymRequest;
import az.jeparla.common.dto.PageDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.common.i18n.SearchText;
import az.jeparla.product.Category;
import az.jeparla.product.CategoryRepository;
import az.jeparla.product.Fineness;
import az.jeparla.product.FinenessRepository;
import az.jeparla.product.ProductRepository;
import az.jeparla.product.ProductVariantRepository;
import az.jeparla.search.SearchSynonym;
import az.jeparla.search.SearchSynonymRepository;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Catalog reference data the admin manages (#40, PLAN 4 and 5.8): the category tree, the finenesses and the
 * search synonyms. Every
 * write is audited ({@code CATALOG} target). Nothing in use is deleted: a category with subcategories or products,
 * or a fineness any variant used, answers 409; deactivate it instead.
 *
 * <p>Public responses of these lists are cached by the CDN ({@code CachePolicy.REFERENCE}, up to an hour); the API
 * keeps no copy of its own, so a change is visible to the next uncached request.
 */
@Service
@PreAuthorize("hasRole('ADMIN')")
public class AdminCatalogService {

    /** V11: one folded word of 2-40 characters. */
    private static final Pattern ONE_WORD = Pattern.compile("[^ ]{2,40}");

    private final CategoryRepository categories;
    private final FinenessRepository finenesses;
    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final SearchSynonymRepository synonyms;
    private final AuditService audit;

    public AdminCatalogService(CategoryRepository categories, FinenessRepository finenesses,
            ProductRepository products, ProductVariantRepository variants, SearchSynonymRepository synonyms,
            AuditService audit) {
        this.categories = categories;
        this.finenesses = finenesses;
        this.products = products;
        this.variants = variants;
        this.synonyms = synonyms;
        this.audit = audit;
    }

    // ------------------------------------------------------------------ categories

    /** Every category, inactive ones too, by sort order; the tree comes from {@code parentId}. */
    @Transactional(readOnly = true)
    public List<AdminCategoryDto> categories() {
        List<Category> all = categories.findAll(Sort.by("sortOrder", "id"));
        Map<Long, Long> productCounts = counts(products.countLiveByCategory());
        Map<Long, Long> childCounts = all.stream().filter(c -> c.getParent() != null)
                .collect(Collectors.groupingBy(c -> c.getParent().getId(), Collectors.counting()));
        return all.stream().map(c -> AdminCategoryDto.of(c, productCounts.getOrDefault(c.getId(), 0L),
                childCounts.getOrDefault(c.getId(), 0L))).toList();
    }

    @Transactional
    public AdminCategoryDto createCategory(CategoryRequest request) {
        if (categories.existsBySlug(request.slug())) {
            throw new ApiException(HttpStatus.CONFLICT, "admin.slug_taken", "slug");
        }
        Category parent = parent(request.parentId());
        Category category = new Category(parent, request.slug(), names(request),
                request.sortOrder() == null ? 0 : request.sortOrder());
        category.setActive(request.active() == null || request.active());
        categories.saveAndFlush(category);
        audit.record("CATEGORY_CREATED", AuditTargetType.CATALOG, category.getId(), category.getName().az(), null,
                AuditDetails.of("kind", "category", "slug", category.getSlug(), "parentId", id(parent),
                        "active", category.isActive()));
        return dto(category);
    }

    @Transactional
    public AdminCategoryDto updateCategory(long id, CategoryRequest request) {
        Category category = categories.findById(id).orElseThrow(ApiException::notFound);
        if (!category.getSlug().equals(request.slug()) && categories.existsBySlug(request.slug())) {
            throw new ApiException(HttpStatus.CONFLICT, "admin.slug_taken", "slug");
        }
        Category parent = parent(request.parentId());
        requireNoCycle(category, parent);
        String fromSlug = category.getSlug();
        Long fromParent = id(category.getParent());
        boolean fromActive = category.isActive();
        category.setSlug(request.slug());
        category.setParent(parent);
        category.setName(names(request));
        category.setSortOrder(request.sortOrder() == null ? category.getSortOrder() : request.sortOrder());
        category.setActive(request.active() == null ? category.isActive() : request.active());
        categories.flush();
        audit.record("CATEGORY_UPDATED", AuditTargetType.CATALOG, category.getId(), category.getName().az(), null,
                AuditDetails.of("kind", "category", "fromSlug", fromSlug, "slug", category.getSlug(),
                        "fromParentId", fromParent, "parentId", id(parent),
                        "fromActive", fromActive, "active", category.isActive()));
        return dto(category);
    }

    /** 409 {@code admin.category_in_use} while it has subcategories or any product (deleted ones too). */
    @Transactional
    public void deleteCategory(long id) {
        Category category = categories.findById(id).orElseThrow(ApiException::notFound);
        if (categories.existsByParentId(id) || products.existsByCategoryId(id)) {
            throw new ApiException(HttpStatus.CONFLICT, "admin.category_in_use");
        }
        audit.record("CATEGORY_DELETED", AuditTargetType.CATALOG, category.getId(), category.getName().az(), null,
                AuditDetails.of("kind", "category", "slug", category.getSlug()));
        categories.delete(category);
        categories.flush();
    }

    // ------------------------------------------------------------------ finenesses

    /** Every fineness, inactive ones too, by metal and sort order. */
    @Transactional(readOnly = true)
    public List<AdminFinenessDto> finenesses() {
        Map<Long, Long> productCounts = counts(variants.countLiveProductsByFineness());
        Set<Long> used = new HashSet<>(variants.findUsedFinenessIds());
        return finenesses.findAll(Sort.by("metal", "sortOrder", "value", "id")).stream()
                .map(f -> AdminFinenessDto.of(f, productCounts.getOrDefault(f.getId(), 0L), used.contains(f.getId())))
                .toList();
    }

    @Transactional
    public AdminFinenessDto createFineness(FinenessRequest request) {
        if (finenesses.findByMetalAndValue(request.metal(), request.value().shortValue()).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "admin.fineness_exists", "value");
        }
        Fineness fineness = new Fineness(request.metal(), request.value(), request.label().strip(),
                request.sortOrder() == null ? 0 : request.sortOrder());
        fineness.setActive(request.active() == null || request.active());
        finenesses.saveAndFlush(fineness);
        audit.record("FINENESS_CREATED", AuditTargetType.CATALOG, fineness.getId(), fineness.getLabel(), null,
                AuditDetails.of("kind", "fineness", "metal", fineness.getMetal(), "value", fineness.getValue(),
                        "active", fineness.isActive()));
        return finenessDto(fineness);
    }

    @Transactional
    public AdminFinenessDto updateFineness(long id, FinenessRequest request) {
        Fineness fineness = finenesses.findById(id).orElseThrow(ApiException::notFound);
        boolean identityChanges = fineness.getMetal() != request.metal() || fineness.getValue() != request.value();
        if (identityChanges) {
            if (variants.existsByFinenessId(id)) {
                throw new ApiException(HttpStatus.CONFLICT, "admin.fineness_in_use", "value");
            }
            finenesses.findByMetalAndValue(request.metal(), request.value().shortValue())
                    .filter(other -> !Objects.equals(other.getId(), fineness.getId()))
                    .ifPresent(other -> {
                        throw new ApiException(HttpStatus.CONFLICT, "admin.fineness_exists", "value");
                    });
        }
        String from = fineness.getMetal() + " " + fineness.getValue() + " " + fineness.getLabel();
        boolean fromActive = fineness.isActive();
        fineness.setMetalAndValue(request.metal(), request.value());
        fineness.setLabel(request.label().strip());
        fineness.setSortOrder(request.sortOrder() == null ? fineness.getSortOrder() : request.sortOrder());
        fineness.setActive(request.active() == null ? fineness.isActive() : request.active());
        finenesses.flush();
        audit.record("FINENESS_UPDATED", AuditTargetType.CATALOG, fineness.getId(), fineness.getLabel(), null,
                AuditDetails.of("kind", "fineness", "from", from, "metal", fineness.getMetal(),
                        "value", fineness.getValue(), "fromActive", fromActive, "active", fineness.isActive()));
        return finenessDto(fineness);
    }

    /** 409 {@code admin.fineness_in_use} when any variant (removed ones too) used it. */
    @Transactional
    public void deleteFineness(long id) {
        Fineness fineness = finenesses.findById(id).orElseThrow(ApiException::notFound);
        if (variants.existsByFinenessId(id)) {
            throw new ApiException(HttpStatus.CONFLICT, "admin.fineness_in_use");
        }
        audit.record("FINENESS_DELETED", AuditTargetType.CATALOG, fineness.getId(), fineness.getLabel(), null,
                AuditDetails.of("kind", "fineness", "metal", fineness.getMetal(), "value", fineness.getValue()));
        finenesses.delete(fineness);
        finenesses.flush();
    }

    // ------------------------------------------------------------------ search synonyms

    /**
     * Synonym pairs, newest first; {@code q} filters by a part of either side (folded, so "sirga" finds "sırğa").
     * The search reads the table on every query (no cache), so changes apply to the next uncached search; public
     * search responses are CDN-cached for at most a few minutes ({@code CachePolicy.CATALOG}).
     */
    @Transactional(readOnly = true)
    public PageDto<AdminSynonymDto> synonyms(String q, int page, int size) {
        PageRequest request = AdminPages.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        String folded = SearchText.fold(q);
        if (folded.isEmpty()) {
            return PageDto.of(synonyms.findAll(request), AdminSynonymDto::of);
        }
        return PageDto.of(synonyms.findByTermFoldedContainingOrSynonymFoldedContaining(folded, folded, request),
                AdminSynonymDto::of);
    }

    @Transactional
    public AdminSynonymDto createSynonym(SynonymRequest request) {
        Pair pair = pair(request, 0);
        SearchSynonym synonym = synonyms.saveAndFlush(new SearchSynonym(pair.term(), pair.synonym()));
        audit.record("SYNONYM_CREATED", AuditTargetType.CATALOG, synonym.getId(), pair.label(), null,
                AuditDetails.of("kind", "synonym", "term", pair.term(), "synonym", pair.synonym()));
        return AdminSynonymDto.of(synonym);
    }

    @Transactional
    public AdminSynonymDto updateSynonym(long id, SynonymRequest request) {
        SearchSynonym synonym = synonyms.findById(id).orElseThrow(ApiException::notFound);
        Pair pair = pair(request, id);
        String from = synonym.getTerm() + " = " + synonym.getSynonym();
        synonym.replace(pair.term(), pair.synonym());
        synonyms.flush();
        audit.record("SYNONYM_UPDATED", AuditTargetType.CATALOG, synonym.getId(), pair.label(), null,
                AuditDetails.of("kind", "synonym", "from", from, "term", pair.term(), "synonym", pair.synonym()));
        return AdminSynonymDto.of(synonym);
    }

    @Transactional
    public void deleteSynonym(long id) {
        SearchSynonym synonym = synonyms.findById(id).orElseThrow(ApiException::notFound);
        audit.record("SYNONYM_DELETED", AuditTargetType.CATALOG, synonym.getId(),
                synonym.getTerm() + " = " + synonym.getSynonym(), null,
                AuditDetails.of("kind", "synonym", "term", synonym.getTerm(), "synonym", synonym.getSynonym()));
        synonyms.delete(synonym);
        synonyms.flush();
    }

    /** One word per side after folding (V11 CHECKs), different sides, a new pair in either order. */
    private Pair pair(SynonymRequest request, long exceptId) {
        String term = request.term().strip();
        String synonym = request.synonym().strip();
        String a = SearchText.fold(term);
        String b = SearchText.fold(synonym);
        if (!ONE_WORD.matcher(a).matches() || !ONE_WORD.matcher(b).matches() || a.equals(b)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.synonym_invalid",
                    ONE_WORD.matcher(a).matches() ? "synonym" : "term");
        }
        if (synonyms.existsPair(a, b, exceptId)) {
            throw new ApiException(HttpStatus.CONFLICT, "admin.synonym_exists", "synonym");
        }
        return new Pair(term, synonym);
    }

    private record Pair(String term, String synonym) {

        String label() {
            return term + " = " + synonym;
        }
    }

    // ------------------------------------------------------------------ helpers

    private AdminCategoryDto dto(Category category) {
        long productCount = counts(products.countLiveByCategory()).getOrDefault(category.getId(), 0L);
        long childCount = categories.findByParentIdOrderBySortOrderAscIdAsc(category.getId()).size();
        return AdminCategoryDto.of(category, productCount, childCount);
    }

    private AdminFinenessDto finenessDto(Fineness fineness) {
        long productCount = counts(variants.countLiveProductsByFineness()).getOrDefault(fineness.getId(), 0L);
        return AdminFinenessDto.of(fineness, productCount, variants.existsByFinenessId(fineness.getId()));
    }

    private Category parent(Long parentId) {
        if (parentId == null) {
            return null;
        }
        return categories.findById(parentId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "admin.parent_missing", "parentId"));
    }

    /** The new parent must not be the category itself or one of its subcategories. */
    private void requireNoCycle(Category category, Category parent) {
        Map<Long, Category> byId = categories.findAll().stream()
                .collect(Collectors.toMap(Category::getId, Function.identity()));
        Set<Long> seen = new HashSet<>();
        for (Category node = parent; node != null; node = parentOf(node, byId)) {
            if (Objects.equals(node.getId(), category.getId()) || !seen.add(node.getId())) {
                throw new ApiException(HttpStatus.CONFLICT, "admin.category_cycle", "parentId");
            }
        }
    }

    private static Category parentOf(Category node, Map<Long, Category> byId) {
        return node.getParent() == null ? null : byId.get(node.getParent().getId());
    }

    private static LocalizedText names(CategoryRequest request) {
        return LocalizedText.of(request.name().az().strip(), request.name().en().strip(), request.name().ru().strip());
    }

    private static Long id(Category category) {
        return category == null ? null : category.getId();
    }

    private static Map<Long, Long> counts(List<Object[]> rows) {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : rows) {
            counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return counts;
    }
}
