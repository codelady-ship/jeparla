package az.jeparla.product;

import az.jeparla.common.web.CachePolicy;
import az.jeparla.product.dto.CategoryDto;
import az.jeparla.product.dto.FinenessDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Category tree and finenesses for the catalog filters (#37). Anonymous, cacheable. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Catalog: categories and finenesses")
public class CategoryController {

    private final ProductCatalogService catalog;

    public CategoryController(ProductCatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/categories")
    @Operation(summary = "Category tree as a flat list",
            description = "Visible categories (the category and its ancestors are active) by sort order. "
                    + "productCount counts listed products of the category and its subcategories.")
    public ResponseEntity<List<CategoryDto>> categories() {
        return ResponseEntity.ok().cacheControl(CachePolicy.REFERENCE).body(catalog.categories());
    }

    @GetMapping("/finenesses")
    @Operation(summary = "Active finenesses", description = "In the admin order (sort order, then id).")
    public ResponseEntity<List<FinenessDto>> finenesses() {
        return ResponseEntity.ok().cacheControl(CachePolicy.REFERENCE).body(catalog.finenesses());
    }
}
