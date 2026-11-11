package az.jeparla.search;

import az.jeparla.product.Category;
import az.jeparla.product.Product;
import az.jeparla.product.ProductVariant;
import az.jeparla.store.Store;
import jakarta.persistence.EntityManagerFactory;
import java.util.Set;
import org.hibernate.engine.spi.SessionFactoryImplementor;
import org.hibernate.event.service.spi.EventListenerRegistry;
import org.hibernate.event.spi.EventType;
import org.hibernate.event.spi.PostCommitDeleteEventListener;
import org.hibernate.event.spi.PostCommitInsertEventListener;
import org.hibernate.event.spi.PostCommitUpdateEventListener;
import org.hibernate.event.spi.PostDeleteEvent;
import org.hibernate.event.spi.PostInsertEvent;
import org.hibernate.event.spi.PostUpdateEvent;
import org.hibernate.persister.entity.EntityPersister;
import org.springframework.stereotype.Component;

/**
 * Empties the {@link SearchCache} after a transaction that saved what search finds (#151): products, their
 * variants (listed only with a live variant; the suggestions carry the price), stores, categories and
 * synonyms. A Hibernate post-commit listener, so every service that changes them through JPA evicts without
 * knowing about the cache, and a rolled-back change evicts nothing.
 */
@Component
class SearchCacheEviction implements PostCommitInsertEventListener, PostCommitUpdateEventListener,
        PostCommitDeleteEventListener {

    private static final Set<Class<?>> WATCHED = Set.of(
            Product.class, ProductVariant.class, Store.class, Category.class, SearchSynonym.class);

    private final SearchCache cache;

    SearchCacheEviction(SearchCache cache, EntityManagerFactory entityManagerFactory) {
        this.cache = cache;
        EventListenerRegistry listeners = entityManagerFactory.unwrap(SessionFactoryImplementor.class)
                .getEventListenerRegistry();
        listeners.appendListeners(EventType.POST_COMMIT_INSERT, this);
        listeners.appendListeners(EventType.POST_COMMIT_UPDATE, this);
        listeners.appendListeners(EventType.POST_COMMIT_DELETE, this);
    }

    @Override
    public boolean requiresPostCommitHandling(EntityPersister persister) {
        return watched(persister.getMappedClass());
    }

    @Override
    public void onPostInsert(PostInsertEvent event) {
        evictIfWatched(event.getEntity());
    }

    @Override
    public void onPostUpdate(PostUpdateEvent event) {
        evictIfWatched(event.getEntity());
    }

    @Override
    public void onPostDelete(PostDeleteEvent event) {
        evictIfWatched(event.getEntity());
    }

    @Override
    public void onPostInsertCommitFailed(PostInsertEvent event) {
        // Nothing was saved.
    }

    @Override
    public void onPostUpdateCommitFailed(PostUpdateEvent event) {
        // Nothing was saved.
    }

    @Override
    public void onPostDeleteCommitFailed(PostDeleteEvent event) {
        // Nothing was saved.
    }

    private void evictIfWatched(Object entity) {
        if (entity != null && watched(entity.getClass())) {
            cache.evictAll();
        }
    }

    private static boolean watched(Class<?> type) {
        for (Class<?> watched : WATCHED) {
            if (watched.isAssignableFrom(type)) {
                return true;
            }
        }
        return false;
    }
}
