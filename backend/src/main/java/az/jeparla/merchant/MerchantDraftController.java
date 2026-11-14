package az.jeparla.merchant;

import az.jeparla.auth.CurrentUser;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.merchant.dto.DraftDtos.DraftDto;
import az.jeparla.merchant.dto.DraftDtos.PdfRequest;
import az.jeparla.merchant.dto.DraftDtos.PdfResultDto;
import az.jeparla.merchant.dto.DraftDtos.PhotoRequest;
import az.jeparla.merchant.dto.DraftDtos.UploadKind;
import az.jeparla.merchant.dto.DraftDtos.UploadRequest;
import az.jeparla.merchant.dto.ImageUploadDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Product drafts of the seller's store from photos and catalog PDFs (#129, #109). */
@RestController
@RequestMapping("/api/v1/merchant/drafts")
@PreAuthorize("hasRole('MERCHANT')")
@Tag(name = "Merchant: drafts", description = "Drafts from phone photos and catalog PDFs (MERCHANT)")
public class MerchantDraftController {

    private final MerchantDraftService drafts;
    private final RateLimitService rateLimits;

    public MerchantDraftController(MerchantDraftService drafts, RateLimitService rateLimits) {
        this.drafts = drafts;
        this.rateLimits = rateLimits;
    }

    @GetMapping
    @Operation(summary = "The store's drafts, newest first, with short-lived photo links")
    public List<DraftDto> list() {
        return drafts.list();
    }

    @PostMapping("/uploads")
    @Operation(summary = "Presigned PUT for one photo (PHOTO, CAMERA) or one catalog PDF (PDF, up to 20 MB)")
    public ImageUploadDto upload(@Valid @RequestBody UploadRequest request) {
        rateLimits.check(request.kind() == UploadKind.PDF ? RateLimitPolicy.CATALOG_PDF_ACCOUNT
                : RateLimitPolicy.IMAGE_UPLOAD_ACCOUNT, "user:" + CurrentUser.id());
        return drafts.upload(request);
    }

    @PostMapping
    @Operation(summary = "The uploaded photo becomes a draft (checked like a product photo, kept private)")
    public ResponseEntity<DraftDto> photo(@Valid @RequestBody PhotoRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(drafts.photo(request));
    }

    @PostMapping("/pdf")
    @Operation(summary = "One draft per photo of the uploaded catalog PDF, with suggestions from its page",
            description = "At most 30 pages and 60 photos; the PDF is deleted after it is read.")
    public PdfResultDto pdf(@Valid @RequestBody PdfRequest request) {
        return drafts.pdf(request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a draft and its photo (another store's draft: 403)")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        drafts.delete(id);
        return ResponseEntity.noContent().build();
    }
}
