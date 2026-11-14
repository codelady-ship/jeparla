package az.jeparla.ai;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiJobAttemptRepository extends JpaRepository<AiJobAttempt, Long> {

    Optional<AiJobAttempt> findFirstByJobIdOrderByNumberDesc(long jobId);
}
