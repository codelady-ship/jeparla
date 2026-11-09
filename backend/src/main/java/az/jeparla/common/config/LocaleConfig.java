package az.jeparla.common.config;

import java.util.List;
import java.util.Locale;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

/**
 * Resolves the response language from the Accept-Language header.
 * Supported: az (default), en, ru. Any other language falls back to az.
 */
@Configuration(proxyBeanMethods = false)
public class LocaleConfig {

    public static final Locale AZ = Locale.forLanguageTag("az");
    public static final List<Locale> SUPPORTED = List.of(AZ, Locale.ENGLISH, Locale.forLanguageTag("ru"));

    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
        resolver.setSupportedLocales(SUPPORTED);
        resolver.setDefaultLocale(AZ);
        return resolver;
    }
}
