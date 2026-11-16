package az.jeparla.store;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** Validity of a code and terms acceptance (#107) without a database; the API side is SellerCodeApiTests. */
class SellerCodeTests {

    private static final Instant NOW = Instant.parse("2026-11-16T10:00:00Z");

    private static Store store() {
        return new Store(null, "s", "Store", "Baku", "Nizami 1", "+994501234567", LegalType.COMPANY, "1234567890");
    }

    @Test
    void theCurrentCodeAndTermsAreValidForAYear() {
        Store store = store();
        store.acceptCode(SellerCode.CURRENT_VERSION, SellerCode.CURRENT_TERMS_VERSION, NOW);

        assertThat(SellerCode.isAccepted(store, NOW.plus(Duration.ofDays(364)))).isTrue();
        assertThat(SellerCode.validUntil(store)).isEqualTo(NOW.plus(SellerCode.VALID_FOR));
        assertThat(SellerCode.isAccepted(store, NOW.plus(SellerCode.VALID_FOR))).isFalse();
    }

    @Test
    void anOlderCodeOrOlderTermsMustBeAcceptedAgain() {
        Store oldCode = store();
        oldCode.acceptCode(SellerCode.CURRENT_VERSION - 1, SellerCode.CURRENT_TERMS_VERSION, NOW);
        Store oldTerms = store();
        oldTerms.acceptCode(SellerCode.CURRENT_VERSION, SellerCode.CURRENT_TERMS_VERSION - 1, NOW);

        assertThat(SellerCode.isAccepted(oldCode, NOW)).isFalse();
        assertThat(SellerCode.validUntil(oldCode)).isNull();
        assertThat(SellerCode.isAccepted(oldTerms, NOW)).isFalse();
        assertThat(SellerCode.isAccepted(store(), NOW)).isFalse();
    }

    @Test
    void codeVersionTwoCarriesTheConsumerRightsClause() {
        // V58 adds version 2 with the clause (Verified.code.8 in the message files).
        assertThat(SellerCode.CURRENT_VERSION).isEqualTo(2);
        assertThat(SellerCode.CURRENT_TERMS_VERSION).isEqualTo(1);
    }
}
