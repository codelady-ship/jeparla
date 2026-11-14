package az.jeparla.ai;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiAssetRepository extends JpaRepository<AiAsset, Long> {

    List<AiAsset> findByJobIdOrderByIdAsc(long jobId);

    List<AiAsset> findByJobIdInOrderByIdAsc(Collection<Long> jobIds);
}
