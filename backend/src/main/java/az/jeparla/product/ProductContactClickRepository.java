package az.jeparla.product;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Daily WhatsApp click counters. Read-only entity; the counter is changed by one atomic upsert. */
public interface ProductContactClickRepository extends Repository<ProductContactClick, ProductContactClick.Key> {

    /** Adds one click; concurrent clicks never lose a count (single INSERT ... ON CONFLICT). */
    @Modifying
    @Query(value = """
            INSERT INTO product_contact_clicks (product_id, day, clicks) VALUES (:productId, :day, 1)
            ON CONFLICT (product_id, day) DO UPDATE SET clicks = product_contact_clicks.clicks + 1
            """, nativeQuery = true)
    void increment(@Param("productId") long productId, @Param("day") LocalDate day);

    /**
     * Adds one click for the ready question the buyer picked (#111) in its own counter table
     * {@code product_contact_question_clicks}; the total above is counted as well.
     */
    @Modifying
    @Query(value = """
            INSERT INTO product_contact_question_clicks (product_id, day, question, clicks)
            VALUES (:productId, :day, :question, 1)
            ON CONFLICT (product_id, day, question)
            DO UPDATE SET clicks = product_contact_question_clicks.clicks + 1
            """, nativeQuery = true)
    void incrementQuestion(@Param("productId") long productId, @Param("day") LocalDate day,
            @Param("question") String question);

    /** Rows of {@code [question, clicks]} for every product of a store since {@code from} (dashboard, #111). */
    @Query(value = """
            SELECT c.question, sum(c.clicks) FROM product_contact_question_clicks c
            JOIN products p ON p.id = c.product_id
            WHERE p.store_id = :storeId AND c.day >= :from
            GROUP BY c.question
            """, nativeQuery = true)
    List<Object[]> sumByQuestionForStoreSince(@Param("storeId") long storeId, @Param("from") LocalDate from);

    /** WhatsApp clicks on every product of a store since {@code from} (merchant dashboard, #39). */
    @Query("""
            select coalesce(sum(c.clicks), 0) from ProductContactClick c, Product p
            where p.id = c.id.productId and p.store.id = :storeId and c.id.day >= :from
            """)
    long sumByStoreSince(@Param("storeId") Long storeId, @Param("from") LocalDate from);

    /** Counters of one product, oldest first (merchant dashboard, #39). */
    @Query("select c from ProductContactClick c where c.id.productId = :productId order by c.id.day")
    List<ProductContactClick> findByProductId(@Param("productId") Long productId);
}
