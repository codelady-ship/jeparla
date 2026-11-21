package az.jeparla.collection;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Occasion collections (#115). */
public interface OccasionCollectionRepository extends JpaRepository<OccasionCollection, Long> {

    /** Every collection, hidden ones too, in the admin order. */
    List<OccasionCollection> findAllByOrderBySortOrderAscIdAsc();

    /** The public list and the seller form: shown collections in the admin order. */
    List<OccasionCollection> findByActiveTrueOrderBySortOrderAscIdAsc();

    boolean existsBySlug(String slug);
}
