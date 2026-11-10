package az.jeparla.pricing;

import az.jeparla.common.dto.Decimal;
import az.jeparla.pricing.MetalPriceAdminService.Change;
import az.jeparla.pricing.MetalPriceJob.Trigger;
import az.jeparla.pricing.dto.AdminMetalPriceDto;
import az.jeparla.pricing.dto.MetalPriceOverrideDto;
import az.jeparla.pricing.dto.MetalPriceOverrideRequest;
import az.jeparla.pricing.dto.QuoteDecisionDto;
import az.jeparla.pricing.dto.QuoteDecisionRequest;
import az.jeparla.product.Metal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin metal prices (#43, PLAN 5.8 / 5.10), the routes of frontend/src/app/api/admin/metal-prices. ADMIN
 * only (URL rule and {@code @PreAuthorize}); every change is audited and reprices the METAL_LINKED
 * variants at once (or on the next scheduled run when a run is in progress).
 */
@RestController
@RequestMapping("/api/v1/admin/metal-prices")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: metal prices", description = "Held CBAR quotes and manual overrides (ADMIN)")
public class AdminMetalPriceController {

    private final MetalPriceAdminService admin;
    private final MetalPriceJob job;

    public AdminMetalPriceController(MetalPriceAdminService admin, MetalPriceJob job) {
        this.admin = admin;
        this.job = job;
    }

    @GetMapping
    @Operation(summary = "Price in use of every metal, with the quote held by the sanity check")
    public List<AdminMetalPriceDto> list() {
        return admin.list();
    }

    @PatchMapping("/{metal}/held")
    @Operation(summary = "Accept or discard the held quote of a metal",
            description = "accept applies it and reprices; discard needs a reason (10-500 characters).")
    @ApiResponse(responseCode = "200", description = "Decided")
    @ApiResponse(responseCode = "400", description = "Unknown action, or discard without a reason")
    @ApiResponse(responseCode = "409", description = "No held quote newer than the price in use")
    public QuoteDecisionDto decide(@PathVariable Metal metal, @Valid @RequestBody QuoteDecisionRequest request) {
        Change change = admin.decideHeld(metal, request.action(), request.reason());
        MetalPriceSnapshot quote = change.quote();
        String repricing = quote.getStatus() == QuoteStatus.APPLIED ? reprice() : "NONE";
        return new QuoteDecisionDto(metal, quote.getStatus(), quote.getNote(), repricing);
    }

    @PutMapping("/{metal}")
    @Operation(summary = "Override the price in use of a metal",
            description = "Stored as an ADMIN quote of today (Asia/Baku) and applied at once. A change above the"
                    + " sanity limit needs confirmLarge = true, otherwise 409 metal_prices.large_change. The next"
                    + " CBAR bulletin replaces it (after the sanity check against it).")
    @ApiResponse(responseCode = "200", description = "Applied")
    @ApiResponse(responseCode = "400", description = "Invalid price or missing reason")
    @ApiResponse(responseCode = "409", description = "Change above the sanity limit without confirmLarge")
    public MetalPriceOverrideDto override(@PathVariable Metal metal,
            @Valid @RequestBody MetalPriceOverrideRequest request) {
        Change change = admin.override(metal, request.pricePerOunce(), request.reason(),
                Boolean.TRUE.equals(request.confirmLarge()));
        MetalPriceSnapshot quote = change.quote();
        return new MetalPriceOverrideDto(metal, quote.getQuoteDate().toString(), Decimal.of(quote.getPricePerOunce()),
                Decimal.of(quote.getPricePerGram()), change.change().toPlainString(), quote.getSource(),
                quote.getNote(), reprice());
    }

    /**
     * Reprices after the decision is committed (the service transaction has ended here). When another
     * run holds the lock, the next scheduled run reprices from the new quote.
     */
    private String reprice() {
        return job.repriceLocked(Trigger.ADMIN).isPresent() ? "DONE" : "DEFERRED";
    }
}
