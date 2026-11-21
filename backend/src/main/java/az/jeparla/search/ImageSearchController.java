package az.jeparla.search;

import az.jeparla.auth.CurrentUser;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.net.IpAddresses;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.product.dto.ProductSummaryDto;
import az.jeparla.search.dto.ImageSearchFilters;
import az.jeparla.search.dto.ImageSearchStatusDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.List;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Search by photo (#163): anonymous, rate limited per client IP ({@link RateLimitPolicy#IMAGE_SEARCH_IP}) and,
 * when signed in, per account ({@link RateLimitPolicy#IMAGE_SEARCH_ACCOUNT}). Never cached: the answer depends
 * on the photo, which is not stored.
 */
@RestController
@RequestMapping("/api/v1/search/image")
@Tag(name = "Search")
public class ImageSearchController {

    private final ImageSearchService search;
    private final RateLimitService rateLimits;

    public ImageSearchController(ImageSearchService search, RateLimitService rateLimits) {
        this.search = search;
        this.rateLimits = rateLimits;
    }

    @GetMapping("/status")
    @Operation(summary = "Whether search by photo is available")
    public ImageSearchStatusDto status() {
        return search.status();
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Listed products similar to a photo, best first",
            description = "Part 'image': JPEG, PNG or WebP (checked by its magic number), at most "
                    + ImageSearchService.MAX_BYTES + " bytes. The photo is processed in memory only: never "
                    + "stored or logged. Only the order is returned, no similarity score. Optional filters "
                    + "(category, metal, fineness, price, store, city) narrow the similar products as on GET /products.")
    @ApiResponse(responseCode = "200", description = "Up to 24 product cards; empty when nothing is similar")
    @ApiResponse(responseCode = "400", description = "search.image_size, search.image_type or "
            + "search.image_unreadable")
    @ApiResponse(responseCode = "429", description = "Too many photo searches")
    @ApiResponse(responseCode = "503", description = "search.image_not_configured: no embedding model installed")
    public ResponseEntity<List<ProductSummaryDto>> search(@RequestPart("image") MultipartFile image,
            @Valid @ParameterObject ImageSearchFilters filters,
            HttpServletRequest request) {
        rateLimits.check(RateLimitPolicy.IMAGE_SEARCH_IP, IpAddresses.rateLimitKey(request.getRemoteAddr()));
        CurrentUser.idIfPresent().ifPresent(id ->
                rateLimits.check(RateLimitPolicy.IMAGE_SEARCH_ACCOUNT, String.valueOf(id)));
        if (image.isEmpty() || image.getSize() > ImageSearchService.MAX_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "search.image_size", "image");
        }
        byte[] bytes;
        try {
            bytes = image.getBytes();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "search.image_unreadable", "image");
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(search.search(bytes, filters == null ? null : filters.toQuery()));
    }
}
