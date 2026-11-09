package az.jeparla.common.web;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Registers {@link CatalogEtagFilter} for the API, inside the Spring Security filter chain. */
@Configuration(proxyBeanMethods = false)
public class WebCacheConfig {

    @Bean
    FilterRegistrationBean<CatalogEtagFilter> catalogEtagFilter() {
        FilterRegistrationBean<CatalogEtagFilter> registration = new FilterRegistrationBean<>(new CatalogEtagFilter());
        registration.addUrlPatterns("/api/v1/*");
        registration.setName("catalogEtagFilter");
        return registration;
    }
}
