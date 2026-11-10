package az.jeparla.notification;

/**
 * The stand-in while no email provider is configured (#131): disabled, so the outbox keeps every message
 * PENDING until a provider sends it. It never pretends to send.
 */
public class NoEmailSender implements EmailSender {

    @Override
    public boolean enabled() {
        return false;
    }

    @Override
    public void send(String to, String subject, String body) {
        throw new IllegalStateException("No email provider is configured (#131)");
    }
}
