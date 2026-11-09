package az.jeparla.common.net;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/**
 * Registers {@link ClientIpFilter} ahead of every other filter (request context, Spring Security),
 * so rate limits and the audit log see the same, proxy-verified client address.
 */
@Configuration(proxyBeanMethods = false)
public class ClientIpConfig {

    private static final Logger log = LoggerFactory.getLogger(ClientIpConfig.class);

    @Bean
    FilterRegistrationBean<ClientIpFilter> clientIpFilter(ClientIpProperties properties) {
        TrustedProxies proxies = properties.proxies();
        log.info("Client IP: X-Forwarded-For is trusted only from {}", proxies.isEmpty() ? "nobody" : proxies);
        FilterRegistrationBean<ClientIpFilter> registration = new FilterRegistrationBean<>(new ClientIpFilter(proxies));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
        return registration;
    }
}
