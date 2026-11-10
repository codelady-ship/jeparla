package az.jeparla.search;

import az.jeparla.common.net.IpAddresses;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.common.web.CachePolicy;
import az.jeparla.product.dto.ProductQuery;
import az.jeparla.search.dto.SearchResultDto;
import az.jeparla.search.dto.SuggestionsDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public search (#38, PLAN 5.3, 5.5). Anonymous and cacheable by a CDN ({@link CachePolicy#CATALOG},
 * ETag), rate limited per client IP ({@link RateLimitPolicy#SEARCH_IP}, 429 with Retry-After).
 * Responses match {@code SearchResult} and {@code Suggestions} in frontend/src/types/api.ts.
 */
@RestController
@RequestMapping("/api/v1/search")
@Tag(name = "Search", description = "Products, stores and categories; Azerbaijani letters folded, typo tolerant")
public class SearchController {

    private static final String Q_DESCRIPTION = "Search words, at most " + ProductQuery.MAX_QUERY_LENGTH
            + " characters (the first 8 words are used). Azerbaijani letters may be typed without diacritics "
            + "(qizil = qızıl, uzuk = üzük); Russian and English names match too; typos are tolerated (uzk = üzük).";

    private final SearchService search;
    private final RateLimitService rateLimits;

    public SearchController(SearchService search, RateLimitService rateLimits) {
        this.search = search;
        this.rateLimits = rateLimits;
    }

    @GetMapping
    @Operation(summary = "Grouped search results",
            description = "Products (paged), stores and categories (at most 100 each), every group best first: "
                    + "whole word > word start > synonym > typo; a store or category named like the query comes "
                    + "first. Only what the public catalog lists. Blank q: everything in the catalog order. "
                    + "The count of each type is products.totalElements, stores.length, categories.length.")
    @ApiResponse(responseCode = "200", description = "Results")
    @ApiResponse(responseCode = "400", description = "Invalid parameter (ProblemDetail with errors)")
    @ApiResponse(responseCode = "429", description = "Too many searches from this address")
    public ResponseEntity<SearchResultDto> search(
            @Parameter(description = Q_DESCRIPTION)
            @RequestParam(required = false) @Size(max = ProductQuery.MAX_QUERY_LENGTH) String q,
            @Parameter(description = "Which groups to fill; the others are empty",
                    schema = @Schema(allowableValues = {"all", "products", "stores", "categories"}, defaultValue = "all"))
            @RequestParam(required = false) @Pattern(regexp = SearchType.PATTERN) String type,
            @Parameter(description = "Zero-based page of the products, default 0")
            @RequestParam(required = false) @Min(0) @Max(ProductQuery.MAX_PAGE) Integer page,
            @Parameter(description = "Products per page 1-" + ProductQuery.MAX_SIZE + ", default "
                    + ProductQuery.DEFAULT_SIZE)
            @RequestParam(required = false) @Min(1) @Max(ProductQuery.MAX_SIZE) Integer size,
            HttpServletRequest request) {
        rateLimits.check(RateLimitPolicy.SEARCH_IP, IpAddresses.rateLimitKey(request.getRemoteAddr()));
        SearchResultDto result = search.search(q, SearchType.of(type), page == null ? 0 : page,
                size == null ? ProductQuery.DEFAULT_SIZE : size);
        return ResponseEntity.ok().cacheControl(CachePolicy.CATALOG).body(result);
    }

    @GetMapping("/suggest")
    @Operation(summary = "Header autocomplete",
            description = "Up to 5 stores, categories and products, best first, ranked like /search. "
                    + "Blank q: every group empty.")
    @ApiResponse(responseCode = "200", description = "Suggestions")
    @ApiResponse(responseCode = "400", description = "Query too long (ProblemDetail with errors)")
    @ApiResponse(responseCode = "429", description = "Too many searches from this address")
    public ResponseEntity<SuggestionsDto> suggest(
            @Parameter(description = Q_DESCRIPTION)
            @RequestParam(required = false) @Size(max = ProductQuery.MAX_QUERY_LENGTH) String q,
            HttpServletRequest request) {
        rateLimits.check(RateLimitPolicy.SEARCH_IP, IpAddresses.rateLimitKey(request.getRemoteAddr()));
        return ResponseEntity.ok().cacheControl(CachePolicy.CATALOG).body(search.suggest(q));
    }
}
