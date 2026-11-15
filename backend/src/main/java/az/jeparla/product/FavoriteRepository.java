package az.jeparla.product;

import java.math.BigDecimal;
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

    /** Every row of the user, newest first (the caller keeps only listed products). */
    @Query("select f from Favorite f where f.user.id = :userId order by f.createdAt desc, f.id desc")
    List<Favorite> findByUserIdNewestFirst(@Param("userId") Long userId);

    /**
     * Saves the product with its current price unless it is saved already (idempotent, also when two requests
     * race: the unique key decides). Returns 1 when a row was added, 0 when it existed.
     */
    @Modifying
    @Query(value = """
            INSERT INTO favorites (user_id, product_id, saved_price, saved_currency)
            VALUES (:userId, :productId, :price, :currency)
            ON CONFLICT ON CONSTRAINT favorites_user_product_key DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("userId") long userId, @Param("productId") long productId,
            @Param("price") BigDecimal price, @Param("currency") String currency);

    /** {@link #insertIfAbsent} with the price and time the guest saved it in the browser (#112). */
    @Modifying
    @Query(value = """
            INSERT INTO favorites (user_id, product_id, saved_price, saved_currency, created_at)
            VALUES (:userId, :productId, :price, :currency, :savedAt)
            ON CONFLICT ON CONSTRAINT favorites_user_product_key DO NOTHING
            """, nativeQuery = true)
    int insertSavedIfAbsent(@Param("userId") long userId, @Param("productId") long productId,
            @Param("price") BigDecimal price, @Param("currency") String currency,
            @Param("savedAt") java.time.Instant savedAt);

    /** Removes one saved product of the user; returns the number of rows removed (0 or 1). */
    @Modifying
    @Query("delete from Favorite f where f.user.id = :userId and f.product.id = :productId")
    int deleteByUserIdAndProductId(@Param("userId") Long userId, @Param("productId") Long productId);
}
