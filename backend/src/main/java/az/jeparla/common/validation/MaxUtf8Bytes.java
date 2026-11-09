package az.jeparla.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.nio.charset.StandardCharsets;

/**
 * The string is at most {@code value} bytes in UTF-8. BCrypt reads only the first 72 bytes of a
 * password, and an Azerbaijani or Russian letter takes 2 bytes, so a character limit is not enough.
 */
@Documented
@Constraint(validatedBy = MaxUtf8Bytes.Validator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface MaxUtf8Bytes {

    int value();

    String message() default "{az.jeparla.common.validation.MaxUtf8Bytes.message}";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<MaxUtf8Bytes, CharSequence> {

        private int max;

        @Override
        public void initialize(MaxUtf8Bytes annotation) {
            this.max = annotation.value();
        }

        @Override
        public boolean isValid(CharSequence value, ConstraintValidatorContext context) {
            return value == null || value.toString().getBytes(StandardCharsets.UTF_8).length <= max;
        }
    }
}
