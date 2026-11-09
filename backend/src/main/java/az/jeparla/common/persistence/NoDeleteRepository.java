package az.jeparla.common.persistence;

import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.repository.Repository;

/**
 * Repository without delete methods, for rows that are never deleted (products: status +
 * {@code deleted_at}, PLAN 5.2) or are history (price history, audit log). The database
 * enforces the rule too (trigger, {@code ON DELETE RESTRICT}); this keeps it out of the API.
 */
@NoRepositoryBean
public interface NoDeleteRepository<T, ID> extends Repository<T, ID> {

    <S extends T> S save(S entity);

    <S extends T> S saveAndFlush(S entity);

    <S extends T> List<S> saveAll(Iterable<S> entities);

    Optional<T> findById(ID id);

    boolean existsById(ID id);

    long count();

    void flush();
}
