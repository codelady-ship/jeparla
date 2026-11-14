package az.jeparla.merchant;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Presigned photo uploads (#154). */
interface ImageUploadSlotRepository extends JpaRepository<ImageUploadSlot, Long> {

    Optional<ImageUploadSlot> findByStorageKey(String storageKey);

    /** Open uploads of a product for {@code kind} whose URL still works. */
    @Query("""
            select count(s) from ImageUploadSlot s
            where s.productId = :productId and s.kind = :kind and s.attachedAt is null and s.discardedAt is null
              and s.expiresAt > :now
            """)
    long countOpen(@Param("productId") long productId, @Param("kind") ImageUploadKind kind, @Param("now") Instant now);

    /** Uploads a store was given since {@code since}, attached or not. */
    long countByStoreIdAndCreatedAtAfter(long storeId, Instant since);

    /** The store's oldest upload since {@code since}: the daily limit frees a place when it is 24 hours old. */
    Optional<ImageUploadSlot> findFirstByStoreIdAndCreatedAtAfterOrderByCreatedAtAsc(long storeId, Instant since);

    /** Open uploads that expired before {@code before}: their staged file is deleted. */
    @Query("""
            select s from ImageUploadSlot s
            where s.attachedAt is null and s.discardedAt is null and s.expiresAt < :before
            order by s.id
            """)
    List<ImageUploadSlot> findStale(@Param("before") Instant before, Pageable page);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update ImageUploadSlot s set s.discardedAt = :now where s.id in :ids and s.attachedAt is null")
    int markDiscarded(@Param("ids") Collection<Long> ids, @Param("now") Instant now);

    /** Removes rows issued before {@code before} that are attached or discarded. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            delete from ImageUploadSlot s
            where s.createdAt < :before and (s.attachedAt is not null or s.discardedAt is not null)
            """)
    int purge(@Param("before") Instant before);
}
