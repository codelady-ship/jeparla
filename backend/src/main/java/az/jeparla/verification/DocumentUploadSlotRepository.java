package az.jeparla.verification;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Presigned document uploads (#40). */
interface DocumentUploadSlotRepository extends JpaRepository<DocumentUploadSlot, Long> {

    Optional<DocumentUploadSlot> findByStorageKey(String storageKey);

    /** Open uploads of a store whose URL still works. */
    @Query("""
            select count(s) from DocumentUploadSlot s
            where s.storeId = :storeId and s.attachedAt is null and s.discardedAt is null and s.expiresAt > :now
            """)
    long countOpen(@Param("storeId") long storeId, @Param("now") Instant now);

    /** Uploads a store was given since {@code since}, attached or not. */
    long countByStoreIdAndCreatedAtAfter(long storeId, Instant since);

    /** The store's oldest upload since {@code since}: the daily limit frees a place when it is 24 hours old. */
    Optional<DocumentUploadSlot> findFirstByStoreIdAndCreatedAtAfterOrderByCreatedAtAsc(long storeId, Instant since);

    /** Open uploads that expired before {@code before}: their staged file is deleted. */
    @Query("""
            select s from DocumentUploadSlot s
            where s.attachedAt is null and s.discardedAt is null and s.expiresAt < :before
            order by s.id
            """)
    List<DocumentUploadSlot> findStale(@Param("before") Instant before, Pageable page);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update DocumentUploadSlot s set s.discardedAt = :now where s.id in :ids and s.attachedAt is null")
    int markDiscarded(@Param("ids") Collection<Long> ids, @Param("now") Instant now);

    /** Removes rows issued before {@code before} that are attached or discarded. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            delete from DocumentUploadSlot s
            where s.createdAt < :before and (s.attachedAt is not null or s.discardedAt is not null)
            """)
    int purge(@Param("before") Instant before);
}
