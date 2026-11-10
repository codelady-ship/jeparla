package az.jeparla.notification.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Number of unread notifications (the badge on the bell). */
@Schema(name = "UnreadCount", requiredProperties = {"unread"})
public record UnreadCountDto(long unread) {
}
