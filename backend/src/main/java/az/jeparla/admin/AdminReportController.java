package az.jeparla.admin;

import az.jeparla.admin.dto.AdminReportDto;
import az.jeparla.admin.dto.AdminReportDto.TargetType;
import az.jeparla.admin.dto.ReportResolutionRequest;
import az.jeparla.common.dto.PageDto;
import az.jeparla.product.ReportStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
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

/** Complaints about products and stores (#40, PLAN 5.8). ADMIN only, every decision audited. */
@RestController
@RequestMapping("/api/v1/admin/reports")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: complaints", description = "Buyer complaints about products and stores (ADMIN)")
public class AdminReportController {

    private final AdminReportService reports;

    public AdminReportController(AdminReportService reports) {
        this.reports = reports;
    }

    @GetMapping
    @Operation(summary = "Complaints by status (default OPEN), newest first; filter by target type and store",
            description = "totalElements of status=OPEN is the open-complaints count of the overview.")
    public PageDto<AdminReportDto> list(@RequestParam(required = false) ReportStatus status,
            @RequestParam(required = false) TargetType targetType, @RequestParam(required = false) Long storeId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return reports.list(status, targetType, storeId, page, size);
    }

    @GetMapping("/{id}")
    public AdminReportDto get(@PathVariable long id) {
        return reports.get(id);
    }

    @PostMapping("/{id}/resolution")
    @Operation(summary = "Close a complaint: RESOLVED (seller notified with the note) or DISMISSED")
    @ApiResponse(responseCode = "200", description = "Closed")
    @ApiResponse(responseCode = "400", description = "admin.reason_required (note of 10+ characters), "
            + "admin.status_invalid (OPEN)")
    @ApiResponse(responseCode = "403", description = "A complaint against the admin's own store")
    @ApiResponse(responseCode = "409", description = "admin.report_closed")
    public AdminReportDto resolve(@PathVariable long id, @Valid @RequestBody ReportResolutionRequest request) {
        return reports.resolve(id, request);
    }
}
