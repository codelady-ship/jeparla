package az.jeparla.common.error;

import az.jeparla.common.dto.FieldViolation;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.context.NoSuchMessageException;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.Errors;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Single error format for the whole API: RFC 9457 {@link ProblemDetail}
 * ({@code application/problem+json}).
 *
 * <p>{@code title} and {@code detail} are localized by HTTP status from {@code messages*.properties}
 * in the request language (Accept-Language: az, en, ru; az by default). Validation errors add an
 * {@code errors} array of {@link FieldViolation}. Internal details (exception messages, stack
 * traces) are never sent to the client.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final MessageSource messages;

    public GlobalExceptionHandler(MessageSource messages) {
        this.messages = messages;
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return validationProblem(ex, violations(ex.getBindingResult()), headers, request);
    }

    @Override
    protected ResponseEntity<Object> handleHandlerMethodValidationException(
            HandlerMethodValidationException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<FieldViolation> violations = new ArrayList<>();
        for (ParameterValidationResult result : ex.getParameterValidationResults()) {
            if (result instanceof ParameterErrors errors) {
                violations.addAll(violations(errors));
            } else {
                String parameter = result.getMethodParameter().getParameterName();
                for (MessageSourceResolvable error : result.getResolvableErrors()) {
                    violations.add(new FieldViolation(parameter, message(error)));
                }
            }
        }
        for (MessageSourceResolvable error : ex.getCrossParameterValidationResults()) {
            violations.add(new FieldViolation(null, message(error)));
        }
        return validationProblem(ex, violations, headers, request);
    }

    /** Last resort: anything not handled above becomes a generic 500 without internal details. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleUnexpected(Exception ex, WebRequest request) {
        log.error("Unhandled exception", ex);
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        return handleExceptionInternal(ex, ProblemDetail.forStatus(status), new HttpHeaders(), status, request);
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        ResponseEntity<Object> response = super.handleExceptionInternal(ex, body, headers, statusCode, request);
        if (response != null && response.getBody() instanceof ProblemDetail problem) {
            int status = statusCode.value();
            problem.setTitle(text("error.title." + status, "error.title.default"));
            problem.setDetail(text("error.detail." + status, "error.detail.default"));
        }
        return response;
    }

    private ResponseEntity<Object> validationProblem(
            Exception ex, List<FieldViolation> violations, HttpHeaders headers, WebRequest request) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        ProblemDetail problem = ProblemDetail.forStatus(status);
        problem.setProperty("errors", violations);
        ResponseEntity<Object> response = handleExceptionInternal(ex, problem, headers, status, request);
        problem.setDetail(text("error.validation.detail", "error.detail.default"));
        return response;
    }

    private List<FieldViolation> violations(Errors result) {
        List<FieldViolation> violations = new ArrayList<>();
        for (FieldError error : result.getFieldErrors()) {
            violations.add(new FieldViolation(error.getField(), message(error)));
        }
        for (ObjectError error : result.getGlobalErrors()) {
            violations.add(new FieldViolation(null, message(error)));
        }
        return violations;
    }

    /** Resolves a constraint message by its codes (e.g. NotBlank.request.name ... NotBlank). */
    private String message(MessageSourceResolvable error) {
        Locale locale = LocaleContextHolder.getLocale();
        try {
            return messages.getMessage(error, locale);
        } catch (NoSuchMessageException e) {
            return messages.getMessage("validation.invalid", null, locale);
        }
    }

    private String text(String code, String fallbackCode) {
        Locale locale = LocaleContextHolder.getLocale();
        String fallback = messages.getMessage(fallbackCode, null, locale);
        return messages.getMessage(code, null, fallback, locale);
    }
}
