package az.jeparla.product;

import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.support.SimpleJpaRepository;
import org.springframework.data.support.PageableExecutionUtils;

/** Fragment implementation of {@link ProductSpecificationQueries} (found by the Impl suffix). */
class ProductSpecificationQueriesImpl implements ProductSpecificationQueries {

    private final EntityManager entityManager;
    private final SimpleJpaRepository<Product, Long> delegate;

    ProductSpecificationQueriesImpl(EntityManager entityManager) {
        this.entityManager = entityManager;
        this.delegate = new SimpleJpaRepository<>(Product.class, entityManager);
    }

    @Override
    public Page<Product> findAllMatching(Specification<Product> spec, Pageable pageable) {
        return delegate.findAll(spec, pageable);
    }

    @Override
    public Page<Product> findAllMatching(Specification<Product> spec, ProductOrder order, Pageable pageable) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Product> select = cb.createQuery(Product.class);
        Root<Product> root = select.from(Product.class);
        Predicate where = spec.toPredicate(root, select, cb);
        select.select(root).orderBy(order.toOrders(root, select, cb));
        if (where != null) {
            select.where(where);
        }
        var query = entityManager.createQuery(select);
        if (pageable.isPaged()) {
            query.setFirstResult(Math.toIntExact(pageable.getOffset())).setMaxResults(pageable.getPageSize());
        }
        List<Product> content = query.getResultList();
        return PageableExecutionUtils.getPage(content, pageable, () -> count(spec));
    }

    private long count(Specification<Product> spec) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Long> count = cb.createQuery(Long.class);
        Root<Product> root = count.from(Product.class);
        Predicate where = spec.toPredicate(root, count, cb);
        count.select(cb.count(root));
        if (where != null) {
            count.where(where);
        }
        return entityManager.createQuery(count).getSingleResult();
    }
}
