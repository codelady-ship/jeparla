package az.jeparla.merchant;

import az.jeparla.auth.CurrentUser;
import az.jeparla.common.i18n.Language;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.merchant.dto.BulkStatusRequest;
import az.jeparla.merchant.dto.BulkStatusResultDto;
import az.jeparla.merchant.dto.ImportResultDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Bulk product work of the seller's own store (#109): spreadsheet import and bulk status changes. */
@RestController
@RequestMapping("/api/v1/merchant/products")
@PreAuthorize("hasRole('MERCHANT')")
@Tag(name = "Merchant: bulk", description = "Spreadsheet import and bulk status of the own products (MERCHANT)")
public class MerchantBulkController {

    private final MerchantBulkService bulk;
    private final RateLimitService rateLimits;

    public MerchantBulkController(MerchantBulkService bulk, RateLimitService rateLimits) {
        this.bulk = bulk;
        this.rateLimits = rateLimits;
    }

    @GetMapping(value = "/import/template", produces = "text/csv")
    @Operation(summary = "The empty CSV template: column labels in az, en or ru")
    public ResponseEntity<byte[]> template(@RequestParam(defaultValue = "az") String lang) {
        Language language;
        try {
            language = Language.fromCode(lang);
        } catch (IllegalArgumentException e) {
            language = Language.AZ;
        }
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("jeparla-products-" + language.code() + ".csv").build().toString())
                .body(bulk.template(language).getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping(value = "/import", consumes = {"text/csv", MediaType.TEXT_PLAIN_VALUE})
    @Operation(summary = "Import DRAFT products from a CSV file (one variant per row, at most 200 rows)",
            description = "Each valid row becomes a DRAFT; invalid rows come back with line, column and a localized"
                    + " message. A repeated Idempotency-Key creates nothing twice. notPreciousConfirmed is the"
                    + " seller's confirmation that the bijouterie rows are not precious metal.")
    public ImportResultDto importCsv(@RequestBody String csv,
            @RequestParam(defaultValue = "false") boolean notPreciousConfirmed,
            @RequestHeader(name = IdempotencyKeys.HEADER, required = false) String idempotencyKey) {
        rateLimits.check(RateLimitPolicy.PRODUCT_IMPORT_ACCOUNT, "user:" + CurrentUser.id());
        return bulk.importCsv(csv, IdempotencyKeys.parse(idempotencyKey), notPreciousConfirmed);
    }

    @PostMapping("/bulk-status")
    @Operation(summary = "Change the status of up to 100 own products, each on its own (e.g. drafts to review)")
    public List<BulkStatusResultDto> bulkStatus(@Valid @RequestBody BulkStatusRequest request) {
        return bulk.changeStatus(request.ids(), request.status());
    }
}
