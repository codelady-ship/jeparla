package az.jeparla.auth.dto;

/** Password rules shared with the frontend ({@code frontend/src/lib/auth/schemas.ts}). */
final class PasswordRules {

    /** At least one letter (any script) and one ASCII digit. */
    static final String LETTER_AND_DIGIT = "^(?=.*\\p{L})(?=.*[0-9]).+$";

    private PasswordRules() {
    }
}
