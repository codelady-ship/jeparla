package az.jeparla.merchant.dto;

import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.store.LegalType;
import az.jeparla.store.SellerKind;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/** The VOEN field of the store application (#317), without a database. */
class StoreRequestTests {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private static StoreRequest request(String taxId, SellerKind kind) {
        return new StoreRequest("Muncuq Evi", "050 123 45 67", null, "Bakı", "Nizami küçəsi 10", "", null, null,
                LegalType.SOLE_TRADER, taxId, kind, true);
    }

    private Set<String> invalidFields(StoreRequest request) {
        Set<ConstraintViolation<StoreRequest>> violations = validator.validate(request);
        return violations.stream().map(v -> v.getPropertyPath().toString()).collect(Collectors.toSet());
    }

    @Test
    void theTaxIdIsTenDigitsOrNothing() {
        assertThat(invalidFields(request("1234567890", SellerKind.PRECIOUS))).isEmpty();
        assertThat(invalidFields(request(null, SellerKind.FASHION))).isEmpty();
        assertThat(invalidFields(request("", SellerKind.FASHION))).isEmpty();
        assertThat(invalidFields(request("12345", SellerKind.FASHION))).containsExactly("taxId");
        assertThat(invalidFields(request("12345678901", SellerKind.PRECIOUS))).containsExactly("taxId");
    }

    @Test
    void aBlankTaxIdIsStoredAsNone() {
        assertThat(request("", SellerKind.FASHION).taxIdOrNull()).isNull();
        assertThat(request(null, SellerKind.FASHION).taxIdOrNull()).isNull();
        assertThat(request("1234567890", SellerKind.MIXED).taxIdOrNull()).isEqualTo("1234567890");
    }
}
