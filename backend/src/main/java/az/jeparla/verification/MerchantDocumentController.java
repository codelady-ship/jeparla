package az.jeparla.verification;

import az.jeparla.auth.CurrentUser;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.verification.dto.DeclarationDto;
import az.jeparla.verification.dto.DocumentConfirmRequest;
import az.jeparla.verification.dto.DocumentUploadDto;
import az.jeparla.verification.dto.DocumentUploadRequest;
import az.jeparla.verification.dto.MerchantDocumentDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Verification documents of the seller's own store (#40, #138); only precious-metal sellers upload. */
@RestController
@RequestMapping("/api/v1/merchant/documents")
@PreAuthorize("hasRole('MERCHANT')")
@Tag(name = "Merchant: documents", description = "Verification documents of the own store (MERCHANT, precious sellers)")
public class MerchantDocumentController {

    private final MerchantDocumentService documents;
    private final RateLimitService rateLimits;

    public MerchantDocumentController(MerchantDocumentService documents, RateLimitService rateLimits) {
        this.documents = documents;
        this.rateLimits = rateLimits;
    }

    @GetMapping
    @Operation(summary = "The store's documents and their review, newest first (no file URLs)")
    public List<MerchantDocumentDto> list() {
        return documents.list();
    }

    @GetMapping("/declaration")
    @Operation(summary = "The declaration to confirm with every upload (final text, #57)")
    public DeclarationDto declaration() {
        return documents.declaration();
    }

    @PostMapping("/uploads")
    @Operation(summary = "Presigned upload URL for one document (PDF, JPEG or PNG, up to 10 MB) in the private bucket",
            description = "403 verification.not_precious for a bijouterie (FASHION) store or product. Rate limited per"
                    + " seller (document-upload-account) and per store.")
    public DocumentUploadDto upload(@Valid @RequestBody DocumentUploadRequest request) {
        // Counted before anything else: each presign lets the browser write up to 10 MB.
        rateLimits.check(RateLimitPolicy.DOCUMENT_UPLOAD_ACCOUNT, "user:" + CurrentUser.id());
        return documents.upload(request);
    }

    @PostMapping
    @Operation(summary = "Confirm an uploaded document with the seller declaration",
            description = "400 verification.declaration_required without declarationAccepted: true; 409"
                    + " verification.declaration_outdated for another version. 201 with the PENDING document.")
    public ResponseEntity<MerchantDocumentDto> confirm(@Valid @RequestBody DocumentConfirmRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(documents.confirm(request));
    }
}
