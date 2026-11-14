package az.jeparla.product;

import az.jeparla.auth.CurrentUser;
import az.jeparla.common.dto.PageDto;
import az.jeparla.common.error.RateLimitExceededException;
import az.jeparla.common.net.IpAddresses;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.common.web.CachePolicy;
import az.jeparla.product.dto.CompareItemDto;
import az.jeparla.product.dto.ProductDto;
import az.jeparla.product.dto.ProductQuery;
import az.jeparla.product.dto.ProductReportRequest;
import az.jeparla.product.dto.ProductSummaryDto;
import az.jeparla.share.ReferralService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Optional;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public product endpoints (#37, PLAN 5.5). GETs are anonymous and cacheable by a CDN
 * ({@link CachePolicy#CATALOG}, ETag); the two POSTs are open to guests and rate limited.
 * Responses match frontend/src/types/api.ts; Accept-Language changes only error messages.
 */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Catalog: products", description = "Listed products only: APPROVED, of an APPROVED store, in a visible category")
public class ProductController {

    /** Favorites page: at most this many product ids per request. */
    static final int MAX_IDS = 100;
    /** Compare page: at most this many variants (frontend MAX_COMPARE). */
    static final int MAX_COMPARE = 4;

    private final ProductCatalogService catalog;
    private final ProductFeedbackService feedback;
    private final RateLimitService rateLimits;

    public ProductController(ProductCatalogService catalog, ProductFeedbackService feedback,
            RateLimitService rateLimits) {
        this.catalog = catalog;
        this.feedback = feedback;
        this.rateLimits = rateLimits;
    }

    @GetMapping("/products")
    @Operation(summary = "Catalog page with filters, sort and pagination",
            description = "Filters combine with AND. Unknown or hidden category: empty page. Stable order: every "
                    + "sort ends with the product id. A page after the last one is empty and keeps the totals.")
    @ApiResponse(responseCode = "200", description = "Page of product cards")
    @ApiResponse(responseCode = "400", description = "Invalid parameter (ProblemDetail with errors)")
    public ResponseEntity<PageDto<ProductSummaryDto>> list(@Valid @ParameterObject ProductQuery query) {
        return ResponseEntity.ok().cacheControl(CachePolicy.CATALOG).body(catalog.list(query));
    }

    @GetMapping(value = "/products", params = "ids")
    @Operation(summary = "Product cards by id (favorites)",
            description = "With ids=1,2,3 the response is a list, not a page: in the order asked, unknown or hidden "
                    + "ids left out. At most " + MAX_IDS + " ids. Empty elements are ignored (ids=, is an empty list).")
    @ApiResponse(responseCode = "200", description = "Product cards")
    @ApiResponse(responseCode = "400", description = "Too many ids, or an id that is not a positive number")
    public ResponseEntity<List<ProductSummaryDto>> byIds(
            @Parameter(description = "Product ids, comma-separated") @RequestParam List<String> ids) {
        List<Long> parsed = IdsParameter.parse(ids, MAX_IDS);
        return ResponseEntity.ok().cacheControl(CachePolicy.CATALOG).body(catalog.byIds(parsed));
    }

    @GetMapping("/products/{slug}")
    @Operation(summary = "Product page")
    @ApiResponse(responseCode = "200", description = "The product with variants and stones")
    @ApiResponse(responseCode = "404", description = "Unknown or not listed")
    public ResponseEntity<ProductDto> bySlug(@PathVariable String slug) {
        return ResponseEntity.ok().cacheControl(CachePolicy.CATALOG).body(catalog.bySlug(slug));
    }

    @GetMapping("/variants")
    @Operation(summary = "Compare columns by variant id",
            description = "In the order asked; removed variants and hidden products are left out. At most "
                    + MAX_COMPARE + " ids. Empty elements are ignored (ids=, is an empty list), as for products.")
    @ApiResponse(responseCode = "200", description = "Compare items")
    @ApiResponse(responseCode = "400", description = "Missing parameter, too many ids, or an id that is not a positive number")
    public ResponseEntity<List<CompareItemDto>> compare(
            @Parameter(description = "Variant ids, comma-separated") @RequestParam List<String> ids) {
        List<Long> parsed = IdsParameter.parse(ids, MAX_COMPARE);
        return ResponseEntity.ok().cacheControl(CachePolicy.CATALOG).body(catalog.compare(parsed));
    }

    @PostMapping("/products/{id}/contact-click")
    @Operation(summary = "Count a WhatsApp contact click",
            description = "Anonymous. Statistics for the store dashboard; clicks over the per-IP limit are "
                    + "silently not counted.")
    @ApiResponse(responseCode = "204", description = "Counted (or ignored over the limit)")
    @ApiResponse(responseCode = "404", description = "Unknown or not listed")
    public ResponseEntity<Void> contactClick(@PathVariable long id,
            @Parameter(description = "Source the visitor arrived with through a shared store link (#100), e.g. "
                    + "instagram; the click is also counted for that source")
            @RequestParam(required = false) String ref,
            @Parameter(description = "Used when ref is absent") @RequestParam(name = "utm_source", required = false)
            String utmSource,
            @RequestHeader(name = HttpHeaders.USER_AGENT, required = false) String userAgent,
            HttpServletRequest request) {
        try {
            rateLimits.check(RateLimitPolicy.CONTACT_IP, IpAddresses.rateLimitKey(request.getRemoteAddr()));
        } catch (RateLimitExceededException overLimit) {
            catalog.requireListed(id);
            return ResponseEntity.noContent().build();
        }
        feedback.contactClick(id, new ReferralService.Hit(ref, utmSource, userAgent, null, request.getRemoteAddr()));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/products/{id}/reports")
    @Operation(summary = "Report a product",
            description = "Guests and signed-in users. Rate limited per IP (report-ip) and per account "
                    + "(report-account); 429 with Retry-After over the limit.")
    @ApiResponse(responseCode = "204", description = "Report saved for the admin queue")
    @ApiResponse(responseCode = "400", description = "Invalid body")
    @ApiResponse(responseCode = "404", description = "Unknown or not listed")
    @ApiResponse(responseCode = "429", description = "Too many reports")
    public ResponseEntity<Void> report(@PathVariable long id, @Valid @RequestBody ProductReportRequest body,
            HttpServletRequest request) {
        Optional<Long> userId = checkReportLimits(request);
        feedback.report(id, body, userId.orElse(null));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/stores/{id}/reports")
    @Operation(summary = "Report a store",
            description = "A complaint about the store as a whole (by its numeric id). Guests and signed-in users, "
                    + "the same rate limits as product reports (report-ip, report-account; shared counters).")
    @ApiResponse(responseCode = "204", description = "Report saved for the admin queue")
    @ApiResponse(responseCode = "400", description = "Invalid body")
    @ApiResponse(responseCode = "404", description = "Unknown or not approved store")
    @ApiResponse(responseCode = "429", description = "Too many reports")
    public ResponseEntity<Void> reportStore(@PathVariable long id, @Valid @RequestBody ProductReportRequest body,
            HttpServletRequest request) {
        Optional<Long> userId = checkReportLimits(request);
        feedback.reportStore(id, body, userId.orElse(null));
        return ResponseEntity.noContent().build();
    }

    /** Report limits are checked before the target is looked up, so they cannot be used to probe ids. */
    private Optional<Long> checkReportLimits(HttpServletRequest request) {
        Optional<Long> userId = CurrentUser.idIfPresent();
        rateLimits.check(RateLimitPolicy.REPORT_IP, IpAddresses.rateLimitKey(request.getRemoteAddr()));
        if (userId.isPresent()) {
            rateLimits.check(RateLimitPolicy.REPORT_ACCOUNT, "user:" + userId.get());
        }
        return userId;
    }
}
