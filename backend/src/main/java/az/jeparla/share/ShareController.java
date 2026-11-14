package az.jeparla.share;

import az.jeparla.common.error.ApiException;
import az.jeparla.common.web.CachePolicy;
import az.jeparla.store.Store;
import az.jeparla.store.StoreFactsService;
import az.jeparla.store.StoreRepository;
import az.jeparla.store.dto.StorePreviewDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public side of the shareable catalog link (#100): resolving {@code /s/<code>} and counting visits that came
 * through a shared link. Anonymous.
 */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Catalog: share links", description = "Share link of a store and its referral counter")
public class ShareController {

    private final StoreFactsService facts;
    private final StoreRepository stores;
    private final ReferralService referrals;

    public ShareController(StoreFactsService facts, StoreRepository stores, ReferralService referrals) {
        this.facts = facts;
        this.stores = stores;
        this.referrals = referrals;
    }

    @GetMapping("/share/{code}")
    @Operation(summary = "The store behind a share link",
            description = "For the frontend's /s/{code} route: redirect to /{locale}/stores/{slug}, keeping ref (or "
                    + "adding ref=link), and the link preview. Counts nothing.")
    @ApiResponse(responseCode = "200", description = "Store preview")
    @ApiResponse(responseCode = "404", description = "Unknown or replaced code, or the store is not public")
    public ResponseEntity<StorePreviewDto> byCode(@PathVariable String code) {
        return ResponseEntity.ok().cacheControl(CachePolicy.CATALOG).body(facts.previewByShareCode(code));
    }

    @PostMapping("/stores/{slug}/visits")
    @Operation(summary = "Count a visit through a shared link",
            description = "Sent once by the store page when its URL has ref or utm_source. Counted per store, day and "
                    + "source only; never for crawlers and link previews, prefetches, over referral-ip, or again from "
                    + "the same address within referral-visit's window. Always 204 for a public store.")
    @ApiResponse(responseCode = "204", description = "Counted or ignored")
    @ApiResponse(responseCode = "404", description = "Unknown or not approved store")
    public ResponseEntity<Void> visit(@PathVariable String slug,
            @Parameter(description = "Source, e.g. instagram, tiktok, whatsapp, tapaz, qr, link")
            @RequestParam(required = false) String ref,
            @Parameter(description = "Used when ref is absent") @RequestParam(name = "utm_source", required = false)
            String utmSource,
            @RequestHeader(name = HttpHeaders.USER_AGENT, required = false) String userAgent,
            @RequestHeader(name = "Sec-Purpose", required = false) String secPurpose,
            @RequestHeader(name = "Purpose", required = false) String purpose,
            HttpServletRequest request) {
        Store store = stores.findPublicBySlug(slug).orElseThrow(ApiException::notFound);
        referrals.visit(store.getId(), new ReferralService.Hit(ref, utmSource, userAgent,
                secPurpose != null ? secPurpose : purpose, request.getRemoteAddr()));
        return ResponseEntity.noContent().build();
    }
}
