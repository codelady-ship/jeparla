package az.jeparla.search;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Ranks products by the cosine similarity of their photos to a query embedding (#163): a product counts with its
 * best photo. Only the order leaves this class; no "similarity percent" is shown to the buyer (honesty rule).
 */
final class ImageSimilarity {

    private ImageSimilarity() {
    }

    /**
     * Product ids, most similar first, at most {@code limit}; candidates whose length differs from the query
     * (another model version) and products below {@code minSimilarity} are left out.
     */
    static List<Long> rank(float[] query, List<ImageEmbeddings.Candidate> candidates, int limit,
            double minSimilarity) {
        double queryNorm = norm(query);
        if (queryNorm == 0) {
            return List.of();
        }
        Map<Long, Double> best = new HashMap<>();
        for (ImageEmbeddings.Candidate candidate : candidates) {
            float[] vector = candidate.embedding();
            if (vector.length != query.length) {
                continue;
            }
            double vectorNorm = norm(vector);
            if (vectorNorm == 0) {
                continue;
            }
            double dot = 0;
            for (int i = 0; i < query.length; i++) {
                dot += (double) query[i] * vector[i];
            }
            double cosine = dot / (queryNorm * vectorNorm);
            if (cosine >= minSimilarity) {
                best.merge(candidate.productId(), cosine, Math::max);
            }
        }
        List<Map.Entry<Long, Double>> ordered = new ArrayList<>(best.entrySet());
        // Ties by product id: the same photo always gives the same order.
        ordered.sort(Map.Entry.<Long, Double>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()));
        return ordered.stream().limit(limit).map(Map.Entry::getKey).toList();
    }

    private static double norm(float[] vector) {
        double sum = 0;
        for (float v : vector) {
            sum += (double) v * v;
        }
        return Math.sqrt(sum);
    }
}
