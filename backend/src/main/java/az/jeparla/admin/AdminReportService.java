package az.jeparla.admin;

import az.jeparla.admin.dto.AdminReportDto;
import az.jeparla.admin.dto.AdminReportDto.TargetType;
import az.jeparla.admin.dto.ReportResolutionRequest;
import az.jeparla.auth.CurrentUser;
import az.jeparla.auth.User;
import az.jeparla.auth.UserRepository;
import az.jeparla.common.dto.PageDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.i18n.Language;
import az.jeparla.notification.NotificationKind;
import az.jeparla.notification.NotificationService;
import az.jeparla.product.Product;
import az.jeparla.product.ProductReport;
import az.jeparla.product.ProductReportRepository;
import az.jeparla.product.ReportStatus;
import az.jeparla.store.Store;
import java.time.Clock;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The complaints queue (#40, PLAN 5.8): buyer reports about products and stores. An admin closes a report with a
 * note: RESOLVED notifies the seller (in-app and email, in the seller's language) with the note only, never with
 * who reported or what they wrote; DISMISSED notifies nobody. Every decision is audited ({@code REPORT} target). An
 * admin does not decide about a complaint against their own store.
 */
@Service
@PreAuthorize("hasRole('ADMIN')")
public class AdminReportService {

    private static final int MIN_NOTE = 10;
    private static final String STORE_LINK = "/merchant/store";
    private static final String PRODUCTS_LINK = "/merchant/products";

    private final ProductReportRepository reports;
    private final UserRepository users;
    private final AuditService audit;
    private final NotificationService notifications;
    private final Clock clock;

    public AdminReportService(ProductReportRepository reports, UserRepository users, AuditService audit,
            NotificationService notifications, Clock clock) {
        this.reports = reports;
        this.users = users;
        this.audit = audit;
        this.notifications = notifications;
        this.clock = clock;
    }

    /** Reports with {@code status} (default OPEN), newest first; optionally of one target type or store. */
    @Transactional(readOnly = true)
    public PageDto<AdminReportDto> list(ReportStatus status, TargetType targetType, Long storeId, int page, int size) {
        ReportStatus wanted = status == null ? ReportStatus.OPEN : status;
        PageRequest request = AdminPages.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        Page<ProductReport> found;
        if (storeId == null) {
            found = targetType == null ? reports.findByStatus(wanted, request)
                    : targetType == TargetType.STORE ? reports.findByStatusAndProductIsNull(wanted, request)
                    : reports.findByStatusAndProductIsNotNull(wanted, request);
        } else {
            found = targetType == null ? reports.findByStatusAndStoreId(wanted, storeId, request)
                    : targetType == TargetType.STORE
                            ? reports.findByStatusAndStoreIdAndProductIsNull(wanted, storeId, request)
                            : reports.findByStatusAndStoreIdAndProductIsNotNull(wanted, storeId, request);
        }
        return PageDto.of(found, AdminReportDto::of);
    }

    @Transactional(readOnly = true)
    public AdminReportDto get(long id) {
        return AdminReportDto.of(reports.findById(id).orElseThrow(ApiException::notFound));
    }

    /** RESOLVED or DISMISSED with a note; a closed report answers 409 {@code admin.report_closed}. */
    @Transactional
    public AdminReportDto resolve(long id, ReportResolutionRequest request) {
        ReportStatus outcome = request.status();
        if (outcome == ReportStatus.OPEN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.status_invalid", "status");
        }
        String note = requireNote(request.note());
        ProductReport report = reports.findForUpdateById(id).orElseThrow(ApiException::notFound);
        Store store = report.getStore();
        if (store.isOwnedBy(CurrentUser.id())) {
            throw new AccessDeniedException("An admin does not decide about complaints against their own store");
        }
        if (!report.isOpen()) {
            throw new ApiException(HttpStatus.CONFLICT, "admin.report_closed");
        }
        User admin = users.findById(CurrentUser.id()).orElse(null);
        report.close(outcome, note, admin, clock.instant());
        Product product = report.getProduct();
        String targetName = product == null ? store.getName() : product.getName().az();
        audit.record(outcome == ReportStatus.RESOLVED ? "REPORT_RESOLVED" : "REPORT_DISMISSED", AuditTargetType.REPORT,
                report.getId(), targetName, note, AuditDetails.of("targetType", product == null ? "STORE" : "PRODUCT",
                        "storeId", store.getId(), "productId", product == null ? null : product.getId(),
                        "reason", report.getReason()));
        if (outcome == ReportStatus.RESOLVED) {
            notifications.notify(store.getOwner(), NotificationKind.REPORT_RESOLVED,
                    locale -> new Object[] {product == null ? store.getName()
                            : product.getName().in(Language.of(locale))},
                    note, product == null ? STORE_LINK : PRODUCTS_LINK);
        }
        return AdminReportDto.of(report);
    }

    private static String requireNote(String note) {
        String stripped = note == null ? "" : note.strip();
        if (stripped.length() < MIN_NOTE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.reason_required", "note");
        }
        return stripped;
    }
}
