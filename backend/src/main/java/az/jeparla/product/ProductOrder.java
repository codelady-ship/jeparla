package az.jeparla.product;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Root;
import java.util.List;

/**
 * Catalog sort orders ({@code ProductSort} in frontend/src/types/api.ts). Every order ends with the
 * product id, so pages are stable: the same request never shows a product twice or skips one.
 * Prices and weights are those of the live variants: {@code priceFrom} is the lowest price.
 */
public enum ProductOrder {

    /** {@code relevance}: without ranked search (#38) the catalog order, oldest product first, as the mock. */
    RELEVANCE("relevance"),
    /** Newest publication first. */
    NEWEST("newest"),
    /** Lowest {@code priceFrom} first. */
    PRICE_ASC("price_asc"),
    /** Highest {@code priceFrom} first. */
    PRICE_DESC("price_desc"),
    /** Lightest live variant first. */
    WEIGHT_ASC("weight_asc");

    private final String value;

    ProductOrder(String value) {
        this.value = value;
    }

    /** The query parameter value, e.g. {@code price_asc}. */
    public String value() {
        return value;
    }

    /** Parses a {@code sort} parameter; null or blank is {@link #RELEVANCE}. */
    public static ProductOrder of(String value) {
        if (value == null || value.isBlank()) {
            return RELEVANCE;
        }
        for (ProductOrder order : values()) {
            if (order.value.equals(value)) {
                return order;
            }
        }
        throw new IllegalArgumentException("Unknown sort: " + value);
    }

    List<Order> toOrders(Root<Product> root, CriteriaQuery<?> query, CriteriaBuilder cb) {
        Order byId = cb.asc(root.get("id"));
        return switch (this) {
            case RELEVANCE -> List.of(byId);
            case NEWEST -> List.of(cb.desc(root.get("publishedAt")), cb.desc(root.get("id")));
            case PRICE_ASC -> List.of(cb.asc(ProductSpecifications.lowestVariant(root, query, cb, "price")), byId);
            case PRICE_DESC -> List.of(cb.desc(ProductSpecifications.lowestVariant(root, query, cb, "price")), byId);
            case WEIGHT_ASC -> List.of(cb.asc(ProductSpecifications.lowestVariant(root, query, cb, "weightGrams")), byId);
        };
    }
}
