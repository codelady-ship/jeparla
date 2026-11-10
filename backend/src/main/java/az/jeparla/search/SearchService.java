package az.jeparla.search;

import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.common.dto.MoneyDto;
import az.jeparla.common.dto.PageDto;
import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.product.ProductCatalogService;
import az.jeparla.product.dto.CategoryDto;
import az.jeparla.product.dto.ProductSummaryDto;
import az.jeparla.search.dto.SearchResultDto;
import az.jeparla.search.dto.SuggestionsDto;
import az.jeparla.search.dto.SuggestionsDto.CategorySuggestion;
import az.jeparla.search.dto.SuggestionsDto.ProductSuggestion;
import az.jeparla.search.dto.SuggestionsDto.StoreSuggestion;
import az.jeparla.store.StoreCatalogService;
import az.jeparla.store.dto.StoreSummaryDto;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import java.math.BigDecimal;
import java.util.Currency;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Search (#38, PLAN 5.3): products, stores and categories in one grouped answer, and the header
 * suggestions. Matching and ranking are in {@link SearchSql}; only what the public catalog lists is
 * found (#37: APPROVED, not deleted, APPROVED store, visible category, at least one live variant;
 * APPROVED stores; visible categories). A blank query (or one without letters or digits) lists
 * everything in the catalog order, like the frontend mock; suggestions are empty for it.
 *
 * <p>Cost: a fixed number of statements whatever the page size (synonyms, one ranked statement per
 * group, then the cards in batches as in the catalog). A query asked again within the cache time
 * ({@link SearchCache}, #151) costs only the cards (search) or nothing (suggestions).
 */
@Service
@Transactional(readOnly = true)
public class SearchService {

    /** Stores and categories are not paged: at most this many of each. */
    static final int MAX_GROUP = 100;
    /** Suggestions per group (PLAN 5.3: "first 3-5"). */
    static final int SUGGESTIONS = 5;

    private final SearchSynonymRepository synonyms;
    private final ProductCatalogService catalog;
    private final StoreCatalogService stores;

    @PersistenceContext
    private EntityManager entityManager;

    private final SearchCache cache;

    public SearchService(SearchSynonymRepository synonyms, ProductCatalogService catalog, StoreCatalogService stores,
            SearchCache cache) {
        this.synonyms = synonyms;
        this.catalog = catalog;
        this.stores = stores;
        this.cache = cache;
    }

    /**
     * {@code GET /search}: the groups of {@code type} (others empty), products paged. The ranking (which ids,
     * in which order) may come from the {@link SearchCache}; the cards are always loaded fresh.
     */
    public SearchResultDto search(String q, SearchType type, int page, int size) {
        List<String> words = SearchTerms.foldedWords(q);
        Ranking ranking = cache.get(new RankingKey(words, type, page, size), () -> rank(words, type, page, size));
        PageDto<ProductSummaryDto> products = type.includes(SearchType.PRODUCTS)
                ? products(ranking, page, size) : PageDto.empty(page, size);
        List<StoreSummaryDto> storeCards = type.includes(SearchType.STORES)
                ? stores.summaries(ranking.storeIds()) : List.of();
        List<CategoryDto> categories = type.includes(SearchType.CATEGORIES)
                ? categories(ranking.categoryIds()) : List.of();
        return new SearchResultDto(q == null ? "" : q, products, storeCards, categories);
    }

    /** {@code GET /search/suggest}: up to {@value #SUGGESTIONS} per group, best first (cached per query). */
    public SuggestionsDto suggest(String q) {
        String query = q == null ? "" : q;
        List<String> words = SearchTerms.foldedWords(q);
        if (words.isEmpty()) {
            return new SuggestionsDto(query, List.of(), List.of(), List.of());
        }
        SuggestionsDto found = cache.get(new SuggestKey(words), () -> suggestions(words));
        return new SuggestionsDto(query, found.stores(), found.categories(), found.products());
    }

    private SuggestionsDto suggestions(List<String> words) {
        SearchTerms terms = terms(words);
        List<StoreSuggestion> storeRows = rows(new SearchSql(terms), sql -> sql.storeSuggestions(SUGGESTIONS)).stream()
                .map(r -> new StoreSuggestion((String) r[0], (String) r[1], (String) r[2]))
                .toList();
        List<CategorySuggestion> categoryRows = rows(new SearchSql(terms), sql -> sql.categorySuggestions(SUGGESTIONS))
                .stream()
                .map(r -> new CategorySuggestion((String) r[0], text(r[1], r[2], r[3])))
                .toList();
        List<ProductSuggestion> productRows = rows(new SearchSql(terms), sql -> sql.productSuggestions(SUGGESTIONS))
                .stream()
                .map(r -> new ProductSuggestion((String) r[0], text(r[1], r[2], r[3]),
                        MoneyDto.of((BigDecimal) r[4], Currency.getInstance(r[5].toString().strip()))))
                .toList();
        return new SuggestionsDto("", storeRows, categoryRows, productRows);
    }

    // ------------------------------------------------------------------ groups

    /** The ranked ids of the groups of {@code type}: what the cache keeps for {@code GET /search}. */
    private Ranking rank(List<String> words, SearchType type, int page, int size) {
        SearchTerms terms = terms(words);
        List<Long> productIds = List.of();
        long total = 0;
        if (type.includes(SearchType.PRODUCTS)) {
            long offset = (long) page * size;
            List<Object[]> rows = rows(new SearchSql(terms), sql -> sql.productPage(size, offset));
            if (!rows.isEmpty()) {
                total = ((Number) rows.getFirst()[1]).longValue();
            } else if (page > 0) {
                total = ((Number) single(new SearchSql(terms), SearchSql::productCount)).longValue();
            }
            productIds = rows.stream().map(r -> ((Number) r[0]).longValue()).toList();
        }
        List<Long> storeIds = type.includes(SearchType.STORES)
                ? ids(new SearchSql(terms), sql -> sql.storeIds(MAX_GROUP)) : List.of();
        List<Long> categoryIds = type.includes(SearchType.CATEGORIES)
                ? ids(new SearchSql(terms), sql -> sql.categoryIds(MAX_GROUP)) : List.of();
        return new Ranking(productIds, total, storeIds, categoryIds);
    }

    private PageDto<ProductSummaryDto> products(Ranking ranking, int page, int size) {
        List<ProductSummaryDto> content = ranking.productIds().isEmpty() ? List.of() : catalog.byIds(ranking.productIds());
        long total = ranking.productTotal();
        int totalPages = (int) ((total + size - 1) / size);
        return new PageDto<>(content, page, size, total, totalPages);
    }

    private List<CategoryDto> categories(List<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Long, CategoryDto> visible = catalog.categories().stream()
                .collect(Collectors.toMap(CategoryDto::id, Function.identity()));
        return ids.stream().map(visible::get).filter(Objects::nonNull).toList();
    }

    // ------------------------------------------------------------------ internals

    private SearchTerms terms(List<String> words) {
        if (words.isEmpty()) {
            return SearchTerms.of(words, List.of());
        }
        List<Map.Entry<String, String>> pairs = synonyms.findTouching(words).stream()
                .map(s -> Map.entry(s.getTermFolded(), s.getSynonymFolded()))
                .toList();
        return SearchTerms.of(words, pairs);
    }

    private List<Long> ids(SearchSql sql, Function<SearchSql, String> statement) {
        return ((List<?>) query(sql, statement).getResultList()).stream().map(id -> ((Number) id).longValue()).toList();
    }

    @SuppressWarnings("unchecked")
    private List<Object[]> rows(SearchSql sql, Function<SearchSql, String> statement) {
        return query(sql, statement).getResultList();
    }

    private Object single(SearchSql sql, Function<SearchSql, String> statement) {
        return query(sql, statement).getSingleResult();
    }

    private Query query(SearchSql sql, Function<SearchSql, String> statement) {
        Query query = entityManager.createNativeQuery(statement.apply(sql));
        sql.params().forEach(query::setParameter);
        return query;
    }

    private static LocalizedTextDto text(Object az, Object en, Object ru) {
        return LocalizedTextDto.of(LocalizedText.of((String) az, (String) en, (String) ru));
    }

    /** Cache key of a search: the folded words (so "Üzük" and "uzuk" share it), the groups and the page. */
    private record RankingKey(List<String> words, SearchType type, int page, int size) {
    }

    /** Cache key of the suggestions for the folded words. */
    private record SuggestKey(List<String> words) {
    }

    /**
     * What {@code GET /search} ranked: product ids of the page with the total, store and category ids, best
     * first; empty for groups not asked for.
     */
    private record Ranking(List<Long> productIds, long productTotal, List<Long> storeIds, List<Long> categoryIds) {
    }
}
