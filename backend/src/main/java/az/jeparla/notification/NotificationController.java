package az.jeparla.notification;

import az.jeparla.common.dto.PageDto;
import az.jeparla.notification.dto.NotificationDto;
import az.jeparla.notification.dto.UnreadCountDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in user's notifications (#138): any role, only their own. */
@RestController
@RequestMapping("/api/v1/notifications")
@PreAuthorize("isAuthenticated()")
@Tag(name = "Notifications", description = "In-app notifications of the signed-in user")
public class NotificationController {

    private final NotificationService notifications;

    public NotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    @Operation(summary = "The user's notifications, newest first")
    public PageDto<NotificationDto> list(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return notifications.mine(page, size);
    }

    @GetMapping("/unread-count")
    public UnreadCountDto unread() {
        return notifications.unread();
    }

    @PostMapping("/{id}/read")
    @Operation(summary = "Mark one notification read (404 for someone else's)")
    public NotificationDto read(@PathVariable long id) {
        return notifications.markRead(id);
    }

    @PostMapping("/read-all")
    public UnreadCountDto readAll() {
        return notifications.markAllRead();
    }
}
