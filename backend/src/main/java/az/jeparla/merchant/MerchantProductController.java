package az.jeparla.merchant;

import az.jeparla.auth.CurrentUser;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.merchant.dto.EvidenceAttachRequest;
import az.jeparla.merchant.dto.ImageAttachRequest;
import az.jeparla.merchant.dto.MerchantEvidencePhotoDto;
import az.jeparla.product.EvidenceKind;
import az.jeparla.merchant.dto.ImageOrderRequest;
import az.jeparla.merchant.dto.ImageUploadDto;
import az.jeparla.merchant.dto.ImageUploadRequest;
import az.jeparla.merchant.dto.MerchantImageDto;
import az.jeparla.merchant.dto.MerchantProductDto;
import az.jeparla.merchant.dto.MerchantProductRowDto;
import az.jeparla.merchant.dto.MerchantVariantDto;
import az.jeparla.merchant.dto.ProductRequest;
import az.jeparla.merchant.dto.StatusChangeRequest;
import az.jeparla.merchant.dto.VariantRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Products, variants and photos of the seller's store (#39). Another seller's product is 403, a missing or
 * deleted one 404 (docs/RBAC.md).
 */
@RestController
@RequestMapping("/api/v1/merchant/products")
@PreAuthorize("hasRole('MERCHANT')")
@Tag(name = "Merchant: products", description = "Products, variants, stones and photos of the own store (MERCHANT)")
public class MerchantProductController {

    private final MerchantProductService products;
    private final MerchantImageService images;
    private final RateLimitService rateLimits;

    public MerchantProductController(MerchantProductService products, MerchantImageService images,
            RateLimitService rateLimits) {
        this.products = products;
        this.images = images;
        this.rateLimits = rateLimits;
    }

    // ------------------------------------------------------------------ products

    @GetMapping
    @Operation(summary = "The store's products (not deleted), last changed first")
    public List<MerchantProductRowDto> list() {
        return products.list();
    }

    @GetMapping("/{id}")
    public MerchantProductDto get(@PathVariable long id) {
        return products.get(id);
    }

    @PostMapping
    @Operation(summary = "Create a DRAFT product with its variants and stones",
            description = "201 created; 200 when the Idempotency-Key repeats an earlier create of this store.")
    public ResponseEntity<MerchantProductDto> create(@Valid @RequestBody ProductRequest request,
            @RequestHeader(name = IdempotencyKeys.HEADER, required = false) String idempotencyKey) {
        Created<MerchantProductDto> result = products.create(request, IdempotencyKeys.parse(idempotencyKey));
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.body());
    }

    @PutMapping("/{id}")
    @Operation(summary = "Replace the product, its stones and variants",
            description = "Variants with an id change, without one are added, missing ones are removed.")
    public MerchantProductDto update(@PathVariable long id, @Valid @RequestBody ProductRequest request) {
        return products.update(id, request);
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Send to review, withdraw, hide or show again")
    public MerchantProductDto changeStatus(@PathVariable long id, @Valid @RequestBody StatusChangeRequest request) {
        return products.changeStatus(id, request.status());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete (INACTIVE + deleted_at; the row stays)")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        products.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ variants

    @PostMapping("/{id}/variants")
    public ResponseEntity<MerchantVariantDto> addVariant(@PathVariable long id,
            @Valid @RequestBody VariantRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(products.addVariant(id, request));
    }

    @PutMapping("/{id}/variants/{variantId}")
    public MerchantVariantDto updateVariant(@PathVariable long id, @PathVariable long variantId,
            @Valid @RequestBody VariantRequest request) {
        return products.updateVariant(id, variantId, request);
    }

    @DeleteMapping("/{id}/variants/{variantId}")
    public ResponseEntity<Void> removeVariant(@PathVariable long id, @PathVariable long variantId) {
        products.removeVariant(id, variantId);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ photos

    @PostMapping("/{id}/images/uploads")
    @Operation(summary = "Presigned upload URL for one photo (JPEG, PNG or WebP, up to 15 MB)",
            description = "Rate limited per seller (image-upload-account, 429 with Retry-After) and per store per"
                    + " day; 409 merchant.image_limit when attached photos and open uploads reach 8")
    public ImageUploadDto upload(@PathVariable long id, @Valid @RequestBody ImageUploadRequest request) {
        // Counted before anything else: each presign lets the browser write up to 15 MB (#154).
        rateLimits.check(RateLimitPolicy.IMAGE_UPLOAD_ACCOUNT, "user:" + CurrentUser.id());
        return images.upload(id, request);
    }

    @PostMapping("/{id}/images")
    @Operation(summary = "Attach an uploaded photo after checking the stored file",
            description = "201 attached; 200 when the key is already attached.")
    public ResponseEntity<MerchantImageDto> attach(@PathVariable long id, @Valid @RequestBody ImageAttachRequest request) {
        Created<MerchantImageDto> result = images.attach(id, request);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.body());
    }

    @PutMapping("/{id}/images/order")
    public MerchantProductDto reorder(@PathVariable long id, @Valid @RequestBody ImageOrderRequest request) {
        return images.reorder(id, request);
    }

    @DeleteMapping("/{id}/images/{imageId}")
    public ResponseEntity<Void> removeImage(@PathVariable long id, @PathVariable long imageId) {
        images.remove(id, imageId);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ hallmark and label photos (#106)

    @PostMapping("/{id}/evidence/{kind}/uploads")
    @Operation(summary = "Presigned upload URL for the hallmark (HALLMARK) or label (TAG) photo",
            description = "Same type, size and rate limits as a gallery photo; 409 merchant.evidence_upload_limit with 3 open"
                    + " uploads of the kind, 409 merchant.hallmark_precious_only for a hallmark of a FASHION product")
    public ImageUploadDto uploadEvidence(@PathVariable long id, @PathVariable EvidenceKind kind,
            @Valid @RequestBody ImageUploadRequest request) {
        rateLimits.check(RateLimitPolicy.IMAGE_UPLOAD_ACCOUNT, "user:" + CurrentUser.id());
        return images.uploadEvidence(id, kind, request);
    }

    @PutMapping("/{id}/evidence/{kind}")
    @Operation(summary = "Set the hallmark or label photo from a checked upload (replaces the previous one)",
            description = "201 set; 200 when the key is already the photo of that kind. The photo waits for an admin"
                    + " check (PENDING); an APPROVED product goes back to review.")
    public ResponseEntity<MerchantEvidencePhotoDto> attachEvidence(@PathVariable long id,
            @PathVariable EvidenceKind kind, @Valid @RequestBody EvidenceAttachRequest request) {
        Created<MerchantEvidencePhotoDto> result = images.attachEvidence(id, kind, request);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.body());
    }

    @DeleteMapping("/{id}/evidence/{kind}")
    @Operation(summary = "Remove the hallmark or label photo (404 when there is none)")
    public ResponseEntity<Void> removeEvidence(@PathVariable long id, @PathVariable EvidenceKind kind) {
        images.removeEvidence(id, kind);
        return ResponseEntity.noContent().build();
    }
}
