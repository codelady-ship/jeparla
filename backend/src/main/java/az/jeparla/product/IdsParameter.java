package az.jeparla.product;

import az.jeparla.common.error.ApiException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;

/**
 * The comma-separated {@code ids} parameter of {@code GET /products?ids=} and {@code /variants?ids=}
 * (#141). Empty elements are ignored ({@code ids=,}, {@code ids=1,,2}, {@code ids=%20}), so a list of
 * only empty elements is an empty list (200 {@code []}). Anything else must be a positive id; garbage
 * or too many ids is a 400 ProblemDetail with an {@code errors} entry for {@code ids}. Duplicates are
 * kept (the caller decides).
 */
final class IdsParameter {

    static final String FIELD = "ids";
    private static final Pattern POSITIVE_ID = Pattern.compile("[1-9][0-9]{0,18}");

    private IdsParameter() {
    }

    static List<Long> parse(List<String> raw, int max) {
        List<Long> ids = new ArrayList<>();
        for (String element : raw == null ? List.<String>of() : raw) {
            String value = element == null ? "" : element.strip();
            if (value.isEmpty()) {
                continue;
            }
            if (!POSITIVE_ID.matcher(value).matches()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "catalog.invalid_ids", FIELD);
            }
            try {
                ids.add(Long.parseLong(value));
            } catch (NumberFormatException overflow) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "catalog.invalid_ids", FIELD);
            }
            if (ids.size() > max) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "catalog.too_many_ids", FIELD);
            }
        }
        return ids;
    }
}
