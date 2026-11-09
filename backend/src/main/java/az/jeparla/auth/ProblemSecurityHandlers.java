package az.jeparla.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerExceptionResolver;
import org.springframework.web.servlet.LocaleResolver;

/**
 * 401 and 403 raised by the security filter chain (before any controller) are handed to the MVC
 * exception resolvers, so {@code GlobalExceptionHandler} writes them as the same localized
 * ProblemDetail as every other API error.
 */
@Component
public class ProblemSecurityHandlers implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final HandlerExceptionResolver resolver;
    private final LocaleResolver localeResolver;

    public ProblemSecurityHandlers(@Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver,
            LocaleResolver localeResolver) {
        this.resolver = resolver;
        this.localeResolver = localeResolver;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException exception) throws IOException {
        resolve(request, response, exception);
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
            AccessDeniedException exception) throws IOException {
        resolve(request, response, exception);
    }

    private void resolve(HttpServletRequest request, HttpServletResponse response, Exception exception)
            throws IOException {
        // The DispatcherServlet has not run yet: resolve the language the same way it would (az default).
        LocaleContextHolder.setLocale(localeResolver.resolveLocale(request));
        if (resolver.resolveException(request, response, null, exception) == null && !response.isCommitted()) {
            response.sendError(exception instanceof AuthenticationException
                    ? HttpServletResponse.SC_UNAUTHORIZED : HttpServletResponse.SC_FORBIDDEN);
        }
    }
}
