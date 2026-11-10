package az.jeparla.search;

/** The {@code type} parameter of {@code GET /search} ({@code SearchType} in frontend/src/types/api.ts). */
public enum SearchType {

    ALL("all"),
    PRODUCTS("products"),
    STORES("stores"),
    CATEGORIES("categories");

    /** Allowed parameter values, for validation and Swagger. */
    public static final String PATTERN = "all|products|stores|categories";

    private final String value;

    SearchType(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    /** Parses a validated parameter; null or blank is {@link #ALL}. */
    public static SearchType of(String value) {
        if (value == null || value.isBlank()) {
            return ALL;
        }
        for (SearchType type : values()) {
            if (type.value.equals(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown search type: " + value);
    }

    /** Whether the results of this type contain the {@code group}. */
    boolean includes(SearchType group) {
        return this == ALL || this == group;
    }
}
