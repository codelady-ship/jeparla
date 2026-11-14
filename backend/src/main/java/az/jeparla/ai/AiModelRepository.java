package az.jeparla.ai;

import az.jeparla.product.Audience;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AiModelRepository extends JpaRepository<AiModel, Long> {

    List<AiModel> findAllByOrderBySortOrderAscIdAsc();

    /** Active models, the default of each audience first. */
    @Query("select m from AiModel m where m.active = true and (:audience is null or m.audience = :audience)"
            + " order by m.isDefault desc, m.sortOrder asc, m.id asc")
    List<AiModel> findActive(@Param("audience") Audience audience);

    /** Clears the default of an audience before another model becomes it (one default per audience, V41). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update AiModel m set m.isDefault = false where m.audience = :audience and m.isDefault = true")
    int clearDefault(@Param("audience") Audience audience);
}
