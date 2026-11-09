package az.jeparla.product;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Category tree. Categories are deactivated, never deleted by the application. */
public interface CategoryRepository extends JpaRepository<Category, Long> {

    Optional<Category> findBySlug(String slug);

    /** Public tree: every active category by sort order; the caller builds the tree from parent ids. */
    List<Category> findByActiveTrueOrderBySortOrderAscIdAsc();

    /** Direct children of a category; with {@code null} the roots. */
    List<Category> findByParentIdOrderBySortOrderAscIdAsc(Long parentId);

    boolean existsBySlug(String slug);
}
