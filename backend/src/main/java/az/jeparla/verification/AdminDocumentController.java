package az.jeparla.verification;

import az.jeparla.common.dto.PageDto;
import az.jeparla.verification.dto.AdminDocumentDto;
import az.jeparla.verification.dto.DocumentDecisionRequest;
import az.jeparla.verification.dto.DocumentViewDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Review of verification documents (#40, #138): ADMIN only, every view and decision audited. */
@RestController
@RequestMapping("/api/v1/admin/documents")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: documents", description = "Review of verification documents (ADMIN)")
public class AdminDocumentController {

    private final AdminDocumentService documents;

    public AdminDocumentController(AdminDocumentService documents) {
        this.documents = documents;
    }

    @GetMapping
    @Operation(summary = "Review queue by status (default PENDING), oldest first")
    public PageDto<AdminDocumentDto> queue(@RequestParam(required = false) DocumentStatus status,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return documents.queue(status, page, size);
    }

    @GetMapping("/{id}")
    public AdminDocumentDto get(@PathVariable UUID id) {
        return documents.get(id);
    }

    @PostMapping("/{id}/view")
    @Operation(summary = "Short-lived download URL of the file (audited as DOCUMENT_VIEWED)")
    public DocumentViewDto view(@PathVariable UUID id) {
        return documents.view(id);
    }

    @PostMapping("/{id}/decision")
    @Operation(summary = "APPROVE, REJECT or REQUEST_CHANGES a PENDING document",
            description = "A refusal needs a reason category; the seller is notified in their language.")
    public AdminDocumentDto decide(@PathVariable UUID id, @Valid @RequestBody DocumentDecisionRequest request) {
        return documents.decide(id, request);
    }
}
