package az.jeparla.common.dto;

/**
 * One invalid input inside a validation ProblemDetail ({@code errors} property).
 *
 * @param field   request field or parameter name; null for object-level errors
 * @param message localized message in the request language
 */
public record FieldViolation(String field, String message) {
}
