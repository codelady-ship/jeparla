package az.jeparla.product;

/**
 * The ready question a buyer picked next to the WhatsApp button (#111). The message texts live in the
 * frontend message files ({@code ContactQuestion} in frontend/src/lib/whatsapp.ts); the backend only
 * counts which kind was used.
 */
public enum ContactQuestion {
    GENERAL,
    AVAILABILITY,
    SIZE,
    VISIT,
    PRICE
}
