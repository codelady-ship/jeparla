package az.jeparla.notification;

import java.util.Locale;

/**
 * What a notification is about. Title and body come from {@code notification.<kind>.title} and
 * {@code notification.<kind>.body} (lower case) in the message files, in az, en and ru. Bodies of the kinds that
 * ask the seller to contact support end with the support contact ({@link SupportProperties}).
 */
public enum NotificationKind {
    DOCUMENT_APPROVED(false),
    DOCUMENT_REJECTED(true),
    DOCUMENT_CHANGES_REQUESTED(true),
    PRODUCT_APPROVED(false),
    PRODUCT_RETURNED(true),
    PRODUCT_DEACTIVATED(true),
    STORE_APPROVED(false),
    STORE_REJECTED(true),
    STORE_BLOCKED(true),
    /** A second admin confirmed a suspected forged document: the store is hidden for review (#138, legal 2d). */
    STORE_SUSPENDED(true),
    SELLER_VERIFIED(false),
    SELLER_REJECTED(true),
    /** A buyer complaint about the seller's product or store was upheld by an admin (#40). */
    REPORT_RESOLVED(true),
    /** An AI Studio result (e.g. the on-model image made after the first photo, #121) waits for approval (#316). */
    AI_RESULT_READY(false);

    private final boolean supportContact;

    NotificationKind(boolean supportContact) {
        this.supportContact = supportContact;
    }

    /** Prefix of the message keys, e.g. {@code notification.document_rejected}. */
    public String messageKey() {
        return "notification." + name().toLowerCase(Locale.ROOT);
    }

    /** Whether the body ends with the support contact (the text asks the seller to contact support). */
    public boolean supportContact() {
        return supportContact;
    }
}
