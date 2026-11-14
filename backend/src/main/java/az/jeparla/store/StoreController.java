package az.jeparla.store;

import az.jeparla.common.dto.PageDto;
import az.jeparla.common.web.CachePolicy;
import az.jeparla.product.dto.ProductQuery;
import az.jeparla.product.dto.ProductSummaryDto;
import az.jeparla.store.dto.StoreDto;
import az.jeparla.store.dto.StoreFactsDto;
import az.jeparla.store.dto.StorePreviewDto;
import az.jeparla.store.dto.StoreSummaryDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Public store endpoints (#37, PLAN 5.5). Anonymous, cacheable by a CDN. */
@RestController
@RequestMapping("/api/v1/stores")
@Tag(name = "Catalog: stores", description = "APPROVED stores only")
public class StoreController {

    private final StoreCatalogService stores;
    private final StoreFactsService facts;

    public StoreController(StoreCatalogService stores, StoreFactsService facts) {
        this.stores = stores;
        this.facts = facts;
    }

    @GetMapping
    @Operation(summary = "Store list", description = "Oldest first, not paged.")
    @ApiResponse(responseCode = "200", description = "Stores")
    @ApiResponse(responseCode = "400", description = "Invalid parameter")
    public ResponseEntity<List<StoreSummaryDto>> list(
            @Parameter(description = "Words that start a word of the store name or city")
            @RequestParam(required = false) @Size(max = ProductQuery.MAX_QUERY_LENGTH) String q,
            @Parameter(description = "City, exact, e.g. Bakı") @RequestParam(required = false) @Size(max = 120) String city) {
        return ResponseEntity.ok().cacheControl(CachePolicy.CATALOG).body(stores.list(q, city));
    }

    @GetMapping("/{slug}")
    @Operation(summary = "Store page")
    @ApiResponse(responseCode = "200", description = "The store with contact details")
    @ApiResponse(responseCode = "404", description = "Unknown or not approved")
    public ResponseEntity<StoreDto> bySlug(@PathVariable String slug) {
        return ResponseEntity.ok().cacheControl(CachePolicy.CATALOG).body(stores.bySlug(slug));
    }

    @GetMapping("/{slug}/products")
    @Operation(summary = "Products of a store", description = "The catalog filters of GET /products; "
            + "the store parameter is replaced by this store.")
    @ApiResponse(responseCode = "200", description = "Page of product cards")
    @ApiResponse(responseCode = "400", description = "Invalid parameter")
    @ApiResponse(responseCode = "404", description = "Unknown or not approved store")
    public ResponseEntity<PageDto<ProductSummaryDto>> products(@PathVariable String slug,
            @Valid @ParameterObject ProductQuery query) {
        return ResponseEntity.ok().cacheControl(CachePolicy.CATALOG).body(stores.products(slug, query));
    }

    @GetMapping("/{slug}/facts")
    @Operation(summary = "Trust facts of a store",
            description = "Measured from the database on the request (#108): months on Jeparla, listed products, "
                    + "share with verified expertise and with a metal-linked price, latest catalog change, verified "
                    + "store documents. Unknown facts are null, never a made-up zero; no ratings, no WhatsApp "
                    + "response time.")
    @ApiResponse(responseCode = "200", description = "Facts")
    @ApiResponse(responseCode = "404", description = "Unknown or not approved")
    public ResponseEntity<StoreFactsDto> facts(@PathVariable String slug) {
        return ResponseEntity.ok().cacheControl(CachePolicy.CATALOG).body(facts.facts(slug));
    }

    @GetMapping("/{slug}/preview")
    @Operation(summary = "Link preview of a store",
            description = "Open Graph data for the store page and its share image (#100): name, city, verified "
                    + "badge, product count, cover image and logo.")
    @ApiResponse(responseCode = "200", description = "Preview")
    @ApiResponse(responseCode = "404", description = "Unknown or not approved")
    public ResponseEntity<StorePreviewDto> preview(@PathVariable String slug) {
        return ResponseEntity.ok().cacheControl(CachePolicy.CATALOG).body(facts.previewBySlug(slug));
    }
}
