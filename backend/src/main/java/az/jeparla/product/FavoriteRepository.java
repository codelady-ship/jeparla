package az.jeparla.product;

import java.util.List;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Saved products of signed-in buyers (PLAN 5.11). Always scoped to the user. */
public interface FavoriteRepository extends Repository<Favorite, Long> {

    Favorite save(Favorite favorite);

    /** The user's list, newest first; only products that are still public. */
    @Query("select f from Favorite f join fetch f.product p join fetch p.store s where f.user.id = :userId and "
            + ProductRepository.PUBLIC + " order by f.createdAt desc, f.id desc")
    List<Favorite> findPublicByUserId(@Param("userId") Long userId);

    boolean existsByUserIdAndProductId(Long userId, Long productId);

    long countByUserId(Long userId);

    /** Removes one saved product of the user; returns the number of rows removed (0 or 1). */
    @Modifying
    @Query("delete from Favorite f where f.user.id = :userId and f.product.id = :productId")
    int deleteByUserIdAndProductId(@Param("userId") Long userId, @Param("productId") Long productId);
}
