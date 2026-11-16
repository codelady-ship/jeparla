package az.jeparla.admin;

import az.jeparla.admin.dto.LegalHoldDto;
import az.jeparla.admin.dto.LegalHoldRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Legal hold on a store's evidence (#138): ADMIN only, audited. */
@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: legal hold", description = "Keep a store's evidence unchanged by the retention job (ADMIN)")
public class AdminLegalHoldController {

    private final AdminLegalHoldService legalHolds;

    public AdminLegalHoldController(AdminLegalHoldService legalHolds) {
        this.legalHolds = legalHolds;
    }

    @GetMapping("/stores/{id}/legal-hold")
    @Operation(summary = "The store's legal hold, if any")
    public LegalHoldDto get(@PathVariable long id) {
        return legalHolds.get(id);
    }

    @PostMapping("/stores/{id}/legal-hold")
    @Operation(summary = "Place (hold true, reason 10-500 characters) or release (hold false) a legal hold")
    public LegalHoldDto change(@PathVariable long id, @Valid @RequestBody LegalHoldRequest request) {
        return legalHolds.change(id, request);
    }
}
