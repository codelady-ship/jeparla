package az.jeparla.common.error;

import az.jeparla.common.dto.FieldViolation;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.TypeMismatchException;
import org.springframework.context.MessageSource;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.context.NoSuchMessageException;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
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

    /** A query or path parameter of the wrong type ({@code page=abc}, {@code metal=COPPER}): 400 with the field. */
    @Override
    protected ResponseEntity<Object> handleTypeMismatch(
            TypeMismatchException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        Locale locale = LocaleContextHolder.getLocale();
        String message = messages.getMessage("typeMismatch", null, locale);
        return validationProblem(ex, List.of(new FieldViolation(ex.getPropertyName(), message)), headers, request);
    }

    /** Expected errors with a code: 401 bad credentials, 409 email taken, 429 rate limit ... */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Object> handleApi(ApiException ex, WebRequest request) {
        HttpHeaders headers = new HttpHeaders();
        headers.addAll(ex.headers());
        ProblemDetail problem = ProblemDetail.forStatus(ex.status());
        if (ex instanceof RateLimitExceededException limited) {
            headers.set(HttpHeaders.RETRY_AFTER, String.valueOf(limited.retryAfterSeconds()));
            problem.setProperty("retryAfter", limited.retryAfterSeconds());
        }
        ResponseEntity<Object> response = handleExceptionInternal(ex, problem, headers, ex.status(), request);
        String detail = text(ex.messageKey(), "error.detail." + ex.status().value(), ex.args());
        problem.setDetail(detail);
        problem.setProperty("code", ex.code());
        if (ex.field() != null) {
            problem.setProperty("errors", List.of(new FieldViolation(ex.field(), detail)));
        }
        return response;
    }

    /**
     * 401: no token, or an invalid, expired or wrongly signed one. Also used by the security filter
     * chain (see {@code ProblemSecurityHandlers}), so filter errors have the same format.
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Object> handleAuthentication(AuthenticationException ex, WebRequest request) {
        String code = ex instanceof OAuth2AuthenticationException ? "auth.invalid_token" : "auth.unauthenticated";
        return securityProblem(ex, HttpStatus.UNAUTHORIZED, code, request);
    }

    /** 403 for a signed-in user without the role or ownership; 401 when nobody is signed in. */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Object> handleAccessDenied(AccessDeniedException ex, WebRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            return securityProblem(ex, HttpStatus.UNAUTHORIZED, "auth.unauthenticated", request);
        }
        return securityProblem(ex, HttpStatus.FORBIDDEN, "auth.forbidden", request);
    }

    private ResponseEntity<Object> securityProblem(Exception ex, HttpStatus status, String code, WebRequest request) {
        HttpHeaders headers = new HttpHeaders();
        if (status == HttpStatus.UNAUTHORIZED) {
            headers.set(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        }
        ProblemDetail problem = ProblemDetail.forStatus(status);
        ResponseEntity<Object> response = handleExceptionInternal(ex, problem, headers, status, request);
        problem.setDetail(text("error." + code, "error.detail." + status.value()));
        problem.setProperty("code", code);
        return response;
    }

    /**
     * A database constraint the service checks could not see coming, typically two requests racing for the
     * same unique value (a double-submitted store, an SKU): 409 {@code conflict}, never the constraint text.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Object> handleConflict(DataIntegrityViolationException ex, WebRequest request) {
        log.warn("Database constraint violated: {}", ex.getMostSpecificCause().getMessage());
        return handleApi(new ApiException(HttpStatus.CONFLICT, "conflict"), request);
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
        return text(code, fallbackCode, null);
    }

    private String text(String code, String fallbackCode, Object[] args) {
        Locale locale = LocaleContextHolder.getLocale();
        String fallback = messages.getMessage(fallbackCode, null, locale);
        return messages.getMessage(code, args, fallback, locale);
    }
}
