package az.jeparla.notification;

import java.util.Locale;

/**
 * What a notification is about. Title and body come from {@code notification.<kind>.title} and
 * {@code notification.<kind>.body} (lower case) in the message files, in az, en and ru.
 */
public enum NotificationKind {
    DOCUMENT_APPROVED,
    DOCUMENT_REJECTED,
    DOCUMENT_CHANGES_REQUESTED,
    PRODUCT_APPROVED,
    PRODUCT_RETURNED,
    PRODUCT_DEACTIVATED,
    STORE_APPROVED,
    STORE_REJECTED,
    STORE_BLOCKED,
    SELLER_VERIFIED,
    SELLER_REJECTED;

    /** Prefix of the message keys, e.g. {@code notification.document_rejected}. */
    public String messageKey() {
        return "notification." + name().toLowerCase(Locale.ROOT);
    }
}
