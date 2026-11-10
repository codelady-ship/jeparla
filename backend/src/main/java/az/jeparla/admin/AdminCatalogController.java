package az.jeparla.admin;

import az.jeparla.admin.dto.AdminCategoryDto;
import az.jeparla.admin.dto.AdminFinenessDto;
import az.jeparla.admin.dto.CategoryRequest;
import az.jeparla.admin.dto.FinenessRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
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

/** Catalog settings (#40, PLAN 5.8): categories and finenesses. ADMIN only, every write audited. */
@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: catalog settings", description = "Categories and finenesses (ADMIN)")
public class AdminCatalogController {

    private final AdminCatalogService catalog;

    public AdminCatalogController(AdminCatalogService catalog) {
        this.catalog = catalog;
    }

    // ------------------------------------------------------------------ categories

    @GetMapping("/categories")
    @Operation(summary = "Every category (inactive too) with product and subcategory counts, flat by sort order")
    public List<AdminCategoryDto> categories() {
        return catalog.categories();
    }

    @PostMapping("/categories")
    @Operation(summary = "Create a category")
    @ApiResponse(responseCode = "201", description = "Created")
    @ApiResponse(responseCode = "400", description = "Invalid body, or admin.parent_missing")
    @ApiResponse(responseCode = "409", description = "admin.slug_taken")
    public ResponseEntity<AdminCategoryDto> createCategory(@Valid @RequestBody CategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(catalog.createCategory(request));
    }

    @PutMapping("/categories/{id}")
    @Operation(summary = "Replace a category (slug, parent, names, order, active)",
            description = "Omitted sortOrder and active keep their values. Deactivate a category instead of "
                    + "deleting one in use: it leaves the public tree.")
    @ApiResponse(responseCode = "200", description = "Saved")
    @ApiResponse(responseCode = "409", description = "admin.slug_taken, or admin.category_cycle (parent is the "
            + "category or one of its subcategories)")
    public AdminCategoryDto updateCategory(@PathVariable long id, @Valid @RequestBody CategoryRequest request) {
        return catalog.updateCategory(id, request);
    }

    @DeleteMapping("/categories/{id}")
    @Operation(summary = "Delete an unused category")
    @ApiResponse(responseCode = "204", description = "Deleted")
    @ApiResponse(responseCode = "409", description = "admin.category_in_use: it has subcategories or products "
            + "(deleted products too)")
    public ResponseEntity<Void> deleteCategory(@PathVariable long id) {
        catalog.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ finenesses

    @GetMapping("/finenesses")
    @Operation(summary = "Every fineness (inactive too) with its product count and whether it is in use")
    public List<AdminFinenessDto> finenesses() {
        return catalog.finenesses();
    }

    @PostMapping("/finenesses")
    @Operation(summary = "Create a fineness")
    @ApiResponse(responseCode = "201", description = "Created")
    @ApiResponse(responseCode = "409", description = "admin.fineness_exists (same metal and value)")
    public ResponseEntity<AdminFinenessDto> createFineness(@Valid @RequestBody FinenessRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(catalog.createFineness(request));
    }

    @PutMapping("/finenesses/{id}")
    @Operation(summary = "Replace a fineness (label, order, active; metal and value only while unused)")
    @ApiResponse(responseCode = "200", description = "Saved")
    @ApiResponse(responseCode = "409", description = "admin.fineness_in_use (metal or value of a used fineness), "
            + "admin.fineness_exists")
    public AdminFinenessDto updateFineness(@PathVariable long id, @Valid @RequestBody FinenessRequest request) {
        return catalog.updateFineness(id, request);
    }

    @DeleteMapping("/finenesses/{id}")
    @Operation(summary = "Delete an unused fineness")
    @ApiResponse(responseCode = "204", description = "Deleted")
    @ApiResponse(responseCode = "409", description = "admin.fineness_in_use: a variant (removed ones too) uses it")
    public ResponseEntity<Void> deleteFineness(@PathVariable long id) {
        catalog.deleteFineness(id);
        return ResponseEntity.noContent().build();
    }
}
