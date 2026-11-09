package az.jeparla.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.common.error.ApiException;
import az.jeparla.product.Category;
import az.jeparla.product.Fineness;
import az.jeparla.product.Metal;
import az.jeparla.product.Product;
import az.jeparla.store.Store;
import az.jeparla.store.StoreAccess;
import az.jeparla.support.AuthIntegrationTest;
import az.jeparla.support.TestData;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

/** Second-user test (issue #34): merchant A cannot change merchant B's store or products. */
@AuthIntegrationTest
class OwnershipTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TestData data;

    @Autowired
    private TransactionTemplate tx;

    @Autowired
    private StoreAccess storeAccess;

    private long merchantA;
    private long merchantB;
    private long storeA;
    private long storeB;
    private long productA;
    private long productB;

    @BeforeEach
    void twoMerchants() {
        tx.executeWithoutResult(status -> {
            var a = data.merchant();
            var b = data.merchant();
            Store sa = data.store(a);
            Store sb = data.store(b);
            Category category = data.category();
            Fineness fineness = data.fineness(Metal.GOLD);
            Product pa = data.product(sa, category, fineness, "100.00");
            Product pb = data.product(sb, category, fineness, "200.00");
            merchantA = a.getId();
            merchantB = b.getId();
            storeA = sa.getId();
            storeB = sb.getId();
            productA = pa.getId();
            productB = pb.getId();
        });
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private static JwtRequestPostProcessor merchant(long userId) {
        return jwt().jwt(token -> token.subject(String.valueOf(userId)))
                .authorities(new SimpleGrantedAuthority("ROLE_MERCHANT"));
    }

    @Test
    void ownerEditsOwnStoreAndProduct() throws Exception {
        mockMvc.perform(patch("/api/v1/merchant/test/stores/" + storeA).with(merchant(merchantA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(storeA));
        mockMvc.perform(patch("/api/v1/merchant/test/products/" + productA).with(merchant(merchantA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(productA));
    }

    @Test
    void otherMerchantsStoreIsForbidden() throws Exception {
        mockMvc.perform(patch("/api/v1/merchant/test/stores/" + storeB).with(merchant(merchantA)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("auth.forbidden"));
        mockMvc.perform(patch("/api/v1/merchant/test/stores/" + storeA).with(merchant(merchantB)))
                .andExpect(status().isForbidden());
    }

    @Test
    void otherMerchantsProductIsForbidden() throws Exception {
        mockMvc.perform(patch("/api/v1/merchant/test/products/" + productB).with(merchant(merchantA)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("auth.forbidden"));
    }

    @Test
    void missingResourceIsNotFound() throws Exception {
        mockMvc.perform(patch("/api/v1/merchant/test/stores/999999999").with(merchant(merchantA)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("not_found"));
        mockMvc.perform(patch("/api/v1/merchant/test/products/999999999").with(merchant(merchantA)))
                .andExpect(status().isNotFound());
    }

    @Test
    void storeAccessUsesTheTokenSubjectAtServiceLevel() {
        Jwt token = Jwt.withTokenValue("t").header("alg", "HS256").subject(String.valueOf(merchantA)).build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(token, AuthorityUtils.createAuthorityList("ROLE_MERCHANT")));

        assertThat(storeAccess.requireOwner(storeA).getId()).isEqualTo(storeA);
        assertThatThrownBy(() -> storeAccess.requireOwner(storeB)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> storeAccess.requireOwner(999_999_999L))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status().value()).isEqualTo(404));
    }

    @Test
    void storeAccessWithoutSignedInUserFails() {
        assertThatThrownBy(() -> storeAccess.requireOwner(storeA))
                .isInstanceOf(org.springframework.security.core.AuthenticationException.class);
    }
}
