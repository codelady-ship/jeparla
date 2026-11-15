package az.jeparla.product;

import az.jeparla.product.dto.FavoriteDto;
import az.jeparla.product.dto.FavoriteImportRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The signed-in buyer's saved products (#41, PLAN 5.11). Always the token's own list; never cached
 * ({@code Cache-Control: no-store}). Guests keep theirs in the browser and import it after sign-in.
 */
@RestController
@RequestMapping("/api/v1/favorites")
@PreAuthorize("hasRole('USER')")
@Tag(name = "Favorites", description = "Saved products of the signed-in user")
public class FavoriteController {

    private final FavoriteService favorites;

    public FavoriteController(FavoriteService favorites) {
        this.favorites = favorites;
    }

    @GetMapping
    @Operation(summary = "My saved products, newest first, with today's and the saved price",
            description = "Products no longer listed are left out (they come back when listed again).")
    public List<FavoriteDto> list() {
        return favorites.list();
    }

    @PutMapping("/{productId}")
    @Operation(summary = "Save a product (idempotent)",
            description = "Saving it again changes nothing; the first saved price stays.")
    @ApiResponse(responseCode = "204", description = "Saved")
    @ApiResponse(responseCode = "404", description = "Unknown or not listed product")
    @ApiResponse(responseCode = "409", description = "favorites.limit (" + FavoriteService.MAX_FAVORITES
            + " products)")
    public ResponseEntity<Void> add(@PathVariable long productId) {
        favorites.add(productId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{productId}")
    @Operation(summary = "Remove a saved product (idempotent)")
    @ApiResponse(responseCode = "204", description = "Removed, or was not saved")
    public ResponseEntity<Void> remove(@PathVariable long productId) {
        favorites.remove(productId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/import")
    @Operation(summary = "Merge the guest's saved list after sign-in",
            description = "Up to 100 ids; unknown, hidden and already saved ones are skipped, so it can be repeated. "
                    + "Returns the merged list.")
    public List<FavoriteDto> importAll(@Valid @RequestBody FavoriteImportRequest request) {
        return favorites.importAll(request.productIds(), request.prices() == null ? List.of() : request.prices());
    }
}
