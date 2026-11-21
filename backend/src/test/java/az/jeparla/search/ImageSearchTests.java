package az.jeparla.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import az.jeparla.common.error.ApiException;
import az.jeparla.product.ProductCatalogService;
import az.jeparla.search.embedding.DisabledImageEmbeddingProvider;
import az.jeparla.search.embedding.ImageEmbeddingProvider;
import az.jeparla.search.embedding.ImageEmbeddingProviders;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

/** Search by photo (#163) without a database: provider selection, photo checks and ranking. */
class ImageSearchTests {

    /** 1x1 PNG. */
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 13, 'I', 'H',
            'D', 'R', 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, (byte) 0xc4, (byte) 0x89};

    private static ImageEmbeddingProviders providers(String selected, ImageEmbeddingProvider... installed) {
        @SuppressWarnings("unchecked")
        ObjectProvider<ImageEmbeddingProvider> candidates = mock(ObjectProvider.class);
        when(candidates.orderedStream()).thenAnswer(i -> Stream.of(installed));
        return new ImageEmbeddingProviders(candidates, selected);
    }

    private static final class StandIn implements ImageEmbeddingProvider {
        @Override
        public String id() {
            return "stand-in";
        }

        @Override
        public boolean configured() {
            return true;
        }

        @Override
        public String model() {
            return "stand-in@1";
        }

        @Override
        public float[] embed(byte[] image, String contentType) {
            return new float[] {1, 0};
        }
    }

    @Test
    void withoutAModelSearchByPhotoIsNotConfiguredAndTouchesNothing() {
        ImageEmbeddings embeddings = mock(ImageEmbeddings.class);
        ProductCatalogService catalog = mock(ProductCatalogService.class);
        ImageSearchService service = new ImageSearchService(providers("none"), embeddings, catalog);
        assertThat(service.status().configured()).isFalse();
        assertThatThrownBy(() -> service.search(PNG)).isInstanceOf(ApiException.class)
                .hasFieldOrPropertyWithValue("code", "search.image_not_configured");
        verifyNoInteractions(embeddings, catalog);
        assertThat(providers("").active()).isInstanceOf(DisabledImageEmbeddingProvider.class);
    }

    @Test
    void filtersNarrowTheSimilarPoolAndKeepItsOrder() {
        ImageEmbeddings embeddings = mock(ImageEmbeddings.class);
        when(embeddings.candidates("stand-in@1")).thenReturn(List.of(
                new ImageEmbeddings.Candidate(1, new float[] {0.6f, 0.8f}),
                new ImageEmbeddings.Candidate(2, new float[] {1, 0.05f}),
                new ImageEmbeddings.Candidate(3, new float[] {-1, 0})));
        ProductCatalogService catalog = mock(ProductCatalogService.class);
        ImageSearchService service = new ImageSearchService(providers("stand-in", new StandIn()), embeddings,
                catalog);
        az.jeparla.product.dto.ProductQuery gold = new az.jeparla.search.dto.ImageSearchFilters(null,
                az.jeparla.product.Metal.GOLD, null, null, null, null, null).toQuery();

        service.search(PNG, gold);

        // Dissimilar product 3 is never offered to the filter; the similar ones go in similarity order.
        org.mockito.Mockito.verify(catalog).byIdsMatching(List.of(2L, 1L), gold, ImageSearchService.RESULTS);
        assertThat(new az.jeparla.search.dto.ImageSearchFilters(null, null, List.of(), null, null, List.of(), "")
                .toQuery()).isNull();
    }

    @Test
    void anUnknownProviderStopsTheStartup() {
        assertThatThrownBy(() -> providers("clip")).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("clip");
        assertThat(providers("stand-in", new StandIn()).active().configured()).isTrue();
    }

    @Test
    void thePhotoIsCheckedByItsMagicNumberAndSize() {
        assertThat(ImageSearchService.check(PNG).contentType()).isEqualTo("image/png");
        assertThatThrownBy(() -> ImageSearchService.check(new byte[0]))
                .hasFieldOrPropertyWithValue("code", "search.image_size");
        assertThatThrownBy(() -> ImageSearchService.check(new byte[ImageSearchService.MAX_BYTES + 1]))
                .hasFieldOrPropertyWithValue("code", "search.image_size");
        assertThatThrownBy(() -> ImageSearchService.check("GIF89a not allowed".getBytes()))
                .hasFieldOrPropertyWithValue("code", "search.image_type");
    }

    @Test
    void productsAreRankedByTheirBestPhotoAndDissimilarOnesAreLeftOut() {
        List<ImageEmbeddings.Candidate> candidates = List.of(
                new ImageEmbeddings.Candidate(1, new float[] {0.6f, 0.8f}),
                new ImageEmbeddings.Candidate(2, new float[] {0.1f, 0.99f}),
                new ImageEmbeddings.Candidate(2, new float[] {1, 0.05f}),
                new ImageEmbeddings.Candidate(3, new float[] {-1, 0}),
                new ImageEmbeddings.Candidate(4, new float[] {1, 0, 0}),
                new ImageEmbeddings.Candidate(5, new float[] {0, 0}));
        assertThat(ImageSimilarity.rank(new float[] {1, 0}, candidates, 10, 0.2)).containsExactly(2L, 1L);
        assertThat(ImageSimilarity.rank(new float[] {1, 0}, candidates, 1, 0.2)).containsExactly(2L);
        assertThat(ImageSimilarity.rank(new float[] {0, 0}, candidates, 10, 0.2)).isEmpty();
    }
}
