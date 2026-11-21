package az.jeparla.search;

import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.product.Metal;
import az.jeparla.product.ProductCatalogService;
import az.jeparla.product.dto.ProductQuery;
import az.jeparla.product.dto.ProductSummaryDto;
import az.jeparla.search.dto.ImageSearchFilters;
import az.jeparla.support.CatalogApiTest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Result filters of search by photo (#163) on the demo catalog: they narrow a ranked list and keep its order. */
@CatalogApiTest
class ImageSearchFilterApiTests {

    @Autowired
    private ProductCatalogService catalog;

    private List<Long> rankedDemoIds() {
        List<Long> ids = new ArrayList<>(catalog.list(ProductQuery.none()).content().stream()
                .map(ProductSummaryDto::id).toList());
        // Any order stands for "most similar first": the filter must keep it.
        Collections.reverse(ids);
        return ids;
    }

    @Test
    void withoutFiltersEveryListedProductStaysInOrder() {
        List<Long> ids = rankedDemoIds();
        ImageSearchFilters none = new ImageSearchFilters(null, null, null, null, null, null, " ");
        assertThat(none.any()).isFalse();
        assertThat(catalog.byIdsMatching(ids, ProductQuery.none(), 100).stream().map(ProductSummaryDto::id))
                .containsExactlyElementsOf(ids);
        assertThat(catalog.byIdsMatching(ids, ProductQuery.none(), 2)).hasSize(2);
    }

    @Test
    void aMetalFilterKeepsOnlyThatMetalInTheRankedOrder() {
        List<Long> ids = rankedDemoIds();
        ProductQuery gold = new ImageSearchFilters(null, Metal.GOLD, null, null, null, null, null).toQuery();

        List<ProductSummaryDto> result = catalog.byIdsMatching(ids, gold, 100);

        assertThat(result).isNotEmpty().allSatisfy(p -> assertThat(p.metal()).isEqualTo(Metal.GOLD));
        List<Long> order = result.stream().map(ProductSummaryDto::id).toList();
        assertThat(ids.stream().filter(order::contains).toList()).containsExactlyElementsOf(order);
    }

    @Test
    void storeAndCityFiltersUseTheProductStore() {
        List<Long> ids = rankedDemoIds();
        ProductSummaryDto first = catalog.byIds(ids).getFirst();

        List<ProductSummaryDto> inStore = catalog.byIdsMatching(ids, new ImageSearchFilters(null, null, null, null,
                null, List.of(first.store().slug()), null).toQuery(), 100);
        assertThat(inStore).isNotEmpty().allSatisfy(p -> assertThat(p.store().slug()).isEqualTo(first.store().slug()));

        List<ProductSummaryDto> inCity = catalog.byIdsMatching(ids, new ImageSearchFilters(null, null, null, null,
                null, null, first.store().city()).toQuery(), 100);
        assertThat(inCity).isNotEmpty().allSatisfy(p -> assertThat(p.store().city()).isEqualTo(first.store().city()));
    }

    @Test
    void anUnknownCategoryMatchesNothing() {
        ProductQuery query = new ImageSearchFilters("no-such-category", null, null, null, null, null, null).toQuery();
        assertThat(catalog.byIdsMatching(rankedDemoIds(), query, 100)).isEmpty();
    }
}
