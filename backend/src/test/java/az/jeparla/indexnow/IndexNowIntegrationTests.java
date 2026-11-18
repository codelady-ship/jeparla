package az.jeparla.indexnow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.jeparla.product.Metal;
import az.jeparla.product.Product;
import az.jeparla.store.Store;
import az.jeparla.store.StoreStatus;
import az.jeparla.support.TestData;
import az.jeparla.support.WithPostgres;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * IndexNow (#62) on PostgreSQL: committed product and store changes reach {@link IndexNowService} after the commit
 * (never for a rollback), and {@link CatalogUrls} turns them into the public pages in three languages: pages that
 * are public now or were public before the change, never a draft.
 */
@WithPostgres
@SpringBootTest(properties = "jeparla.support.site-url=https://jeparla.example")
class IndexNowIntegrationTests {

    private static final String SITE = "https://jeparla.example";

    @MockitoBean
    private IndexNowService indexNow;

    @Autowired
    private CatalogUrls urls;

    @Autowired
    private TestData data;

    @Autowired
    private TransactionTemplate tx;

    @Autowired
    private EntityManager em;

    @BeforeEach
    void on() {
        reset(indexNow);
        when(indexNow.enabled()).thenReturn(true);
    }

    @SuppressWarnings("unchecked")
    private List<CatalogChange> reported() {
        ArgumentCaptor<Collection<CatalogChange>> captor = ArgumentCaptor.forClass(Collection.class);
        verify(indexNow, atLeastOnce()).changed(captor.capture());
        List<CatalogChange> all = new ArrayList<>();
        captor.getAllValues().forEach(all::addAll);
        return all;
    }

    private static List<String> pages(String path) {
        return List.of(SITE + "/az" + path, SITE + "/en" + path, SITE + "/ru" + path);
    }

    @Test
    void aPublishedProductIsReportedAfterTheCommitWithItsPagesInThreeLanguages() {
        Product product = tx.execute(status -> {
            Store store = data.approvedStore(data.merchant());
            return data.publicProduct(store, data.category(), data.fineness(Metal.GOLD), "300.00");
        });

        assertThat(reported()).contains(CatalogChange.product(product.getId(), false));
        assertThat(urls.of(List.of(CatalogChange.product(product.getId(), false))))
                .containsExactlyElementsOf(pages("/products/" + product.getSlug()));
    }

    @Test
    void aRolledBackChangeIsNeverReported() {
        tx.executeWithoutResult(status -> {
            Store store = data.approvedStore(data.merchant());
            data.publicProduct(store, data.category(), data.fineness(Metal.GOLD), "300.00");
            status.setRollbackOnly();
        });
        verify(indexNow, never()).changed(anyCollection());
    }

    @Test
    void aHiddenProductIsReportedSoTheEnginesSeeItGoneButADraftNever() {
        long[] ids = tx.execute(status -> {
            Store store = data.approvedStore(data.merchant());
            Product shown = data.publicProduct(store, data.category(), data.fineness(Metal.GOLD), "300.00");
            Product draft = data.product(store, data.category(), data.fineness(Metal.GOLD), "200.00");
            return new long[] {shown.getId(), draft.getId()};
        });
        reset(indexNow);
        when(indexNow.enabled()).thenReturn(true);

        String slug = tx.execute(status -> {
            Product product = em.find(Product.class, ids[0]);
            product.hideBySeller();
            return product.getSlug();
        });

        assertThat(reported()).contains(CatalogChange.product(ids[0], true));
        assertThat(urls.of(List.of(CatalogChange.product(ids[0], true))))
                .containsExactlyElementsOf(pages("/products/" + slug));
        assertThat(urls.of(List.of(CatalogChange.product(ids[0], false)))).as("not public now, not before").isEmpty();
        assertThat(urls.of(List.of(CatalogChange.product(ids[1], false)))).isEmpty();
    }

    @Test
    void aBlockedStoreBringsItsProductPagesAlong() {
        long[] ids = tx.execute(status -> {
            Store store = data.approvedStore(data.merchant());
            Product product = data.publicProduct(store, data.category(), data.fineness(Metal.GOLD), "300.00");
            return new long[] {store.getId(), product.getId()};
        });
        reset(indexNow);
        when(indexNow.enabled()).thenReturn(true);

        tx.executeWithoutResult(status -> em.find(Store.class, ids[0]).setStatus(StoreStatus.BLOCKED));

        CatalogChange change = CatalogChange.store(ids[0], true, true);
        assertThat(reported()).contains(change);
        String[] slugs = tx.execute(status -> new String[] {em.find(Store.class, ids[0]).getSlug(),
                em.find(Product.class, ids[1]).getSlug()});
        List<String> expected = new ArrayList<>(pages("/stores/" + slugs[0]));
        expected.addAll(pages("/products/" + slugs[1]));
        assertThat(urls.of(List.of(change))).containsExactlyInAnyOrderElementsOf(expected);
    }

    @Test
    void aPendingStoreHasNoPublicPage() {
        long storeId = tx.execute(status -> data.store(data.merchant()).getId());
        assertThat(urls.of(List.of(CatalogChange.store(storeId, false, false)))).isEmpty();
        tx.executeWithoutResult(status -> em.find(Store.class, storeId).approve(Instant.parse("2026-11-18T08:00:00Z")));
        assertThat(reported()).contains(CatalogChange.store(storeId, false, true));
    }
}
