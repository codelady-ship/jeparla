package az.jeparla.collection;

import az.jeparla.collection.dto.CollectionDto;
import az.jeparla.common.web.CachePolicy;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Occasion collections (#115) for the collection pages, the sitemap and the seller form. Anonymous, cacheable. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Catalog: occasion collections")
public class CollectionController {

    private final CollectionService collections;

    public CollectionController(CollectionService collections) {
        this.collections = collections;
    }

    @GetMapping("/collections")
    @Operation(summary = "Shown occasion collections",
            description = "In the admin order. productCount counts listed products tagged with the collection; the "
                    + "products are GET /products?collection={slug}. Hidden collections are left out.")
    public ResponseEntity<List<CollectionDto>> collections() {
        return ResponseEntity.ok().cacheControl(CachePolicy.REFERENCE).body(collections.shown());
    }
}
