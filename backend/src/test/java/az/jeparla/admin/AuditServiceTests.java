package az.jeparla.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.auth.User;
import az.jeparla.store.Store;
import az.jeparla.support.JpaTest;
import az.jeparla.support.TestData;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@JpaTest
class AuditServiceTests {

    @Autowired
    private AuditService audit;

    @Autowired
    private TestData data;

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    private static void signIn(User user, String role) {
        Jwt token = Jwt.withTokenValue("t").header("alg", "HS256").subject(String.valueOf(user.getId())).build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(token, AuthorityUtils.createAuthorityList("ROLE_" + role)));
    }

    @Test
    void recordsTheSignedInMerchantRoleAndIp() {
        User merchant = data.merchant();
        Store store = data.store(merchant);
        signIn(merchant, "MERCHANT");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.7");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        AuditLog entry = audit.record("STORE_UPDATED", AuditTargetType.STORE, store.getId(), store.getName(),
                null, "{\"fields\":[\"address\"]}");

        assertThat(entry.getId()).isNotNull();
        assertThat(entry.getActor()).isEqualTo(merchant);
        assertThat(entry.getActorRole()).isEqualTo(ActorRole.MERCHANT);
        assertThat(entry.getActorLabel()).contains(merchant.getEmail());
        assertThat(entry.getTargetId()).isEqualTo(String.valueOf(store.getId()));
        assertThat(entry.getIpAddress().getHostAddress()).isEqualTo("203.0.113.7");
    }

    @Test
    void withoutUserItIsASystemEntry() {
        AuditLog entry = audit.record("PRICES_APPLIED", AuditTargetType.PRICE, null, null, null, null);
        assertThat(entry.getActor()).isNull();
        assertThat(entry.getActorRole()).isEqualTo(ActorRole.SYSTEM);
        assertThat(entry.getActorLabel()).isEqualTo("system");
        assertThat(entry.getIpAddress()).isNull();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void needsTheCallersTransaction() {
        assertThatThrownBy(() -> audit.record("X", AuditTargetType.USER, 1, null, null, null))
                .isInstanceOf(IllegalTransactionStateException.class);
    }
}
