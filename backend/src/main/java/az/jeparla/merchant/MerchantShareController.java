package az.jeparla.merchant;

import az.jeparla.merchant.dto.ReferralStatsDto;
import az.jeparla.merchant.dto.ShareLinkDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The seller's shareable catalog link, its QR code and where its visitors came from (#100). MERCHANT only. */
@RestController
@RequestMapping("/api/v1/merchant")
@PreAuthorize("hasRole('MERCHANT')")
@Tag(name = "Merchant: share link", description = "Shareable catalog link, QR code and referral statistics (MERCHANT)")
public class MerchantShareController {

    static final MediaType SVG = MediaType.valueOf("image/svg+xml");

    private final MerchantShareService share;

    public MerchantShareController(MerchantShareService share) {
        this.share = share;
    }

    @GetMapping("/store/share")
    @Operation(summary = "The store's share link", description = "404 merchant.no_store before the application.")
    public ShareLinkDto link() {
        return share.link();
    }

    @GetMapping(value = "/store/share/qr.svg", produces = "image/svg+xml")
    @Operation(summary = "QR code of the share link (SVG)",
            description = "Opens the link with ref=qr. Dark green on white with the standard quiet zone; print it or "
                    + "rasterise it to PNG in the browser.")
    @ApiResponse(responseCode = "200", description = "SVG document", content = @Content(mediaType = "image/svg+xml"))
    public ResponseEntity<String> qr() {
        return ResponseEntity.ok().contentType(SVG).cacheControl(CacheControl.noStore()).body(share.qrSvg());
    }

    @PostMapping("/store/share/regenerate")
    @Operation(summary = "Replace the share link",
            description = "The old link and printed QR codes stop working. Audited. 403 merchant.store_blocked for a "
                    + "blocked store; 429 over share-regenerate-account (5 per day).")
    public ShareLinkDto regenerate() {
        return share.regenerate();
    }

    @GetMapping("/referrals")
    @Operation(summary = "Visits and WhatsApp clicks through shared links, by source",
            description = "Aggregated daily counters of the signed-in seller's store. 400 merchant.referral_days for "
                    + "a window other than 30 or 90.")
    public ReferralStatsDto referrals(
            @Parameter(description = "30 or 90") @RequestParam(defaultValue = "30") int days) {
        return share.stats(days);
    }
}
