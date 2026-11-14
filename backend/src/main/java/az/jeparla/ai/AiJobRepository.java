package az.jeparla.ai;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AiJobRepository extends JpaRepository<AiJob, Long> {

    Optional<AiJob> findByStoreIdAndIdempotencyKey(long storeId, UUID idempotencyKey);

    List<AiJob> findTop50ByProductIdOrderByCreatedAtDescIdDesc(long productId);

    /**
     * The oldest queued job, row-locked for this transaction; a job another worker holds is skipped, so two
     * instances never run the same job.
     */
    @Query(value = "SELECT id FROM ai_jobs WHERE status = 'QUEUED' ORDER BY created_at, id LIMIT 1"
            + " FOR UPDATE SKIP LOCKED", nativeQuery = true)
    Optional<Long> claimNextQueued();

    /** Jobs left PROCESSING by a crashed or stuck attempt. */
    @Query("select j from AiJob j where j.status = az.jeparla.ai.AiJobStatus.PROCESSING and j.updatedAt < :before")
    List<AiJob> findStuck(@Param("before") Instant before);
}
