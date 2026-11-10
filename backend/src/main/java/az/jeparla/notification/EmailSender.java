package az.jeparla.notification;

/**
 * Sends one email. The provider is chosen in #131; until then {@link NoEmailSender} is the bean and the
 * outbox keeps the messages PENDING (nothing is claimed as sent). A provider implements this interface and
 * becomes the bean; its keys come only from the environment.
 */
public interface EmailSender {

    /** Whether a real provider is configured; {@link EmailOutboxJob} sends nothing otherwise. */
    boolean enabled();

    /**
     * Sends a plain-text email.
     *
     * @throws RuntimeException when the provider refuses it; the message is retried later
     */
    void send(String to, String subject, String body);
}
