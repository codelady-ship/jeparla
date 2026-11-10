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
