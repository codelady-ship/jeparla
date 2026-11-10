package az.jeparla.merchant;

/**
 * Result of an idempotent create: {@code created} is false when the same Idempotency-Key already created
 * {@code body} (the controller answers 200 instead of 201).
 */
public record Created<T>(T body, boolean created) {
}
