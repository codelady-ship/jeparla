package az.jeparla.product;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinenessRepository extends JpaRepository<Fineness, Long> {

    /** Public list ({@code GET /finenesses}) and the merchant form. */
    List<Fineness> findByActiveTrueOrderByMetalAscSortOrderAscValueAsc();

    /** Public list in the admin order ({@code GET /api/v1/finenesses}, #37). */
    List<Fineness> findByActiveTrueOrderBySortOrderAscIdAsc();

    Optional<Fineness> findByMetalAndValue(Metal metal, short value);
}
