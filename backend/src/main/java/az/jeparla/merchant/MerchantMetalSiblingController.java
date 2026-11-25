package az.jeparla.merchant;

import az.jeparla.merchant.dto.MetalSiblingRequest;
import az.jeparla.merchant.dto.MetalSiblingsDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Same design in another metal (V69): the seller links two own precious products; another seller's is 403. */
@RestController
@RequestMapping("/api/v1/merchant/products/{id}/metal-sibling")
@PreAuthorize("hasRole('MERCHANT')")
@Tag(name = "Merchant: products", description = "Products, variants, stones and photos of the own store (MERCHANT)")
public class MerchantMetalSiblingController {

    private final MerchantMetalSiblings siblings;

    public MerchantMetalSiblingController(MerchantMetalSiblings siblings) {
        this.siblings = siblings;
    }

    @GetMapping
    @Operation(summary = "The linked product in another metal and the products that may be linked")
    public MetalSiblingsDto get(@PathVariable long id) {
        return siblings.get(id);
    }

    @PutMapping
    @Operation(summary = "Link the same design in another metal, or unlink with siblingId null",
            description = "400 merchant.metal_sibling for itself, another store's or a bijouterie product, or the"
                    + " same metal.")
    public MetalSiblingsDto set(@PathVariable long id, @Valid @RequestBody MetalSiblingRequest request) {
        return siblings.set(id, request.siblingId());
    }
}
