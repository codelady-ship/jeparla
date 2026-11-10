package az.jeparla.notification.dto;

import az.jeparla.notification.Notification;
import az.jeparla.notification.NotificationKind;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/** One in-app notification (#138); {@code readAt} is null while unread. */
@Schema(name = "Notification", requiredProperties = {"id", "kind", "language", "title", "body", "createdAt"})
public record NotificationDto(long id, NotificationKind kind, String language, String title, String body,
        String link, Instant createdAt, Instant readAt) {

    public static NotificationDto of(Notification notification) {
        return new NotificationDto(notification.getId(), notification.getKind(), notification.getLanguage().code(),
                notification.getTitle(), notification.getBody(), notification.getLink(), notification.getCreatedAt(),
                notification.getReadAt());
    }
}
