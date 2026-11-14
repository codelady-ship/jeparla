package az.jeparla.verification;

import az.jeparla.common.dto.PageDto;
import az.jeparla.verification.dto.StoreSuspensionDto;
import az.jeparla.verification.dto.SuspensionDecisionRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Store suspensions over suspected forged documents (#138): ADMIN only, a second admin decides. */
@RestController
@RequestMapping("/api/v1/admin/store-suspensions")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: store suspensions", description = "Four-eyes suspension over suspected forged documents (ADMIN)")
public class AdminSuspensionController {

    private final StoreSuspensionService suspensions;

    public AdminSuspensionController(StoreSuspensionService suspensions) {
        this.suspensions = suspensions;
    }

    @GetMapping
    @Operation(summary = "Suspension requests by status (default PENDING), oldest first")
    public PageDto<StoreSuspensionDto> queue(@RequestParam(required = false) StoreSuspensionRequest.Status status,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return suspensions.queue(status, page, size);
    }

    @PostMapping("/{id}/decision")
    @Operation(summary = "CONFIRM (the store is hidden, the seller notified) or DISMISS a PENDING request",
            description = "Only an admin other than the one who opened the request (409 verification.four_eyes).")
    public StoreSuspensionDto decide(@PathVariable long id, @Valid @RequestBody SuspensionDecisionRequest request) {
        return suspensions.decide(id, request);
    }
}
