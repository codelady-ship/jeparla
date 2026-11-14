package az.jeparla.admin;

import az.jeparla.admin.dto.AdminEvidencePhotoDto;
import az.jeparla.admin.dto.EvidenceCheckRequest;
import az.jeparla.common.dto.PageDto;
import az.jeparla.verification.CheckStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Hallmark and label photos (#106): the check queue and the decision. ADMIN only, every decision audited. */
@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: evidence photos", description = "Hallmark and label photos of products (ADMIN)")
public class AdminEvidenceController {

    private final AdminEvidenceService evidence;

    public AdminEvidenceController(AdminEvidenceService evidence) {
        this.evidence = evidence;
    }

    @GetMapping("/evidence-photos")
    @Operation(summary = "Hallmark and label photos by status (default PENDING), oldest first, with the product data")
    public PageDto<AdminEvidencePhotoDto> queue(@RequestParam(required = false) CheckStatus status,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return evidence.queue(status, page, size);
    }

    @GetMapping("/products/{id}/evidence-photos")
    @Operation(summary = "The hallmark and label photos of one product (none, one or two)")
    public List<AdminEvidencePhotoDto> ofProduct(@PathVariable long id) {
        return evidence.ofProduct(id);
    }

    @PostMapping("/evidence-photos/{photoId}/check")
    @Operation(summary = "VERIFIED (matches the product data) or REJECTED (reason) a hallmark or label photo")
    @ApiResponse(responseCode = "200", description = "Checked")
    @ApiResponse(responseCode = "400", description = "admin.status_invalid (not VERIFIED or REJECTED), "
            + "admin.reason_required (REJECTED without a reason of 10+ characters)")
    @ApiResponse(responseCode = "403", description = "A photo of the admin's own store")
    public AdminEvidencePhotoDto check(@PathVariable long photoId, @Valid @RequestBody EvidenceCheckRequest request) {
        return evidence.check(photoId, request);
    }
}
