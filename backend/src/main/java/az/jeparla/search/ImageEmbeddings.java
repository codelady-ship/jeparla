package az.jeparla.search;

import java.sql.Array;
import java.sql.SQLException;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Embeddings of listed product photos (#163, V43). Only original photos (not AI-generated) of products the public
 * catalog lists are embedded and searched ({@link SearchSql#LISTED_PRODUCT}, the same rule as text search).
 */
@Repository
class ImageEmbeddings {

    /** A photo still without an embedding of the current model. */
    record Missing(long imageId, String storageKey, String contentType) {
    }

    /** An embedding with its product. */
    record Candidate(long productId, float[] embedding) {
    }

    private static final String LISTED_PHOTOS = SearchSql.VISIBLE_CATEGORIES + """
            SELECT %s
            FROM product_images pi
                     JOIN products p ON p.id = pi.product_id
                     JOIN stores s ON s.id = p.store_id
            %s
            WHERE pi.ai_generated = FALSE AND %s
            """;

    private final JdbcTemplate jdbc;

    ImageEmbeddings(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    List<Missing> missing(String model, int limit) {
        String sql = LISTED_PHOTOS.formatted("pi.id, pi.storage_key, pi.content_type", "",
                SearchSql.LISTED_PRODUCT + """

                          AND NOT EXISTS (SELECT 1 FROM product_image_embeddings e
                                          WHERE e.image_id = pi.id AND e.model = ?)
                        ORDER BY pi.id
                        LIMIT ?""");
        return jdbc.query(sql, (rs, i) -> new Missing(rs.getLong(1), rs.getString(2), rs.getString(3)), model, limit);
    }

    void save(long imageId, String model, float[] embedding) {
        jdbc.update(connection -> {
            Float[] boxed = new Float[embedding.length];
            for (int i = 0; i < embedding.length; i++) {
                boxed[i] = embedding[i];
            }
            var statement = connection.prepareStatement("""
                    INSERT INTO product_image_embeddings (image_id, model, embedding) VALUES (?, ?, ?)
                    ON CONFLICT (image_id, model) DO UPDATE SET embedding = EXCLUDED.embedding, created_at = now()""");
            statement.setLong(1, imageId);
            statement.setString(2, model);
            statement.setArray(3, connection.createArrayOf("real", boxed));
            return statement;
        });
    }

    /** Every embedding of {@code model} of a listed product (a small catalog: compared in memory). */
    List<Candidate> candidates(String model) {
        String sql = LISTED_PHOTOS.formatted("p.id, e.embedding",
                "JOIN product_image_embeddings e ON e.image_id = pi.id AND e.model = ?", SearchSql.LISTED_PRODUCT);
        return jdbc.query(sql, (rs, i) -> new Candidate(rs.getLong(1), floats(rs.getArray(2))), model);
    }

    private static float[] floats(Array array) throws SQLException {
        Object[] values = (Object[]) array.getArray();
        float[] result = new float[values.length];
        for (int i = 0; i < values.length; i++) {
            result[i] = ((Number) values[i]).floatValue();
        }
        return result;
    }
}
