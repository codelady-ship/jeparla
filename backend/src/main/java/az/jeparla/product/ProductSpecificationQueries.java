package az.jeparla.product;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

/**
 * Read-only specification queries for products. {@code JpaSpecificationExecutor} is not used
 * because it also exposes {@code delete(...)} and {@code update(...)}; products are never deleted.
 */
public interface ProductSpecificationQueries {

    /** Products matching {@code spec}, e.g. {@code isPublic().and(inCategories(ids))}. */
    Page<Product> findAllMatching(Specification<Product> spec, Pageable pageable);

    /**
     * Products matching {@code spec} in a catalog order that may sort by variant prices or weights
     * (subqueries, which a {@code Sort} cannot express). The sort of {@code pageable} is ignored.
     */
    Page<Product> findAllMatching(Specification<Product> spec, ProductOrder order, Pageable pageable);
}
