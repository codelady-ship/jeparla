package az.jeparla.product;

import jakarta.persistence.EntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.support.SimpleJpaRepository;

/** Fragment implementation of {@link ProductSpecificationQueries} (found by the Impl suffix). */
class ProductSpecificationQueriesImpl implements ProductSpecificationQueries {

    private final SimpleJpaRepository<Product, Long> delegate;

    ProductSpecificationQueriesImpl(EntityManager entityManager) {
        this.delegate = new SimpleJpaRepository<>(Product.class, entityManager);
    }

    @Override
    public Page<Product> findAllMatching(Specification<Product> spec, Pageable pageable) {
        return delegate.findAll(spec, pageable);
    }
}
