package az.jeparla.admin;

import az.jeparla.admin.dto.AdminCollectionDto;
import az.jeparla.admin.dto.CollectionOrderRequest;
import az.jeparla.admin.dto.CollectionRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Occasion collections (#115): create, rename, reorder, hide. ADMIN only, every write audited. */
@RestController
@RequestMapping("/api/v1/admin/collections")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: occasion collections", description = "Collections sellers tag their products with (ADMIN)")
public class AdminCollectionController {

    private final AdminCollectionService collections;

    public AdminCollectionController(AdminCollectionService collections) {
        this.collections = collections;
    }

    @GetMapping
    @Operation(summary = "Every collection (hidden too) with its tagged product count, in order")
    public List<AdminCollectionDto> list() {
        return collections.list();
    }

    @PostMapping
    @Operation(summary = "Create a collection")
    @ApiResponse(responseCode = "201", description = "Created")
    @ApiResponse(responseCode = "409", description = "admin.slug_taken")
    public ResponseEntity<AdminCollectionDto> create(@Valid @RequestBody CollectionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(collections.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Rename, hide or show a collection",
            description = "Omitted sortOrder and active keep their values. Hide a collection instead of deleting it: "
                    + "it leaves the site and the seller form and keeps its tags.")
    @ApiResponse(responseCode = "200", description = "Saved")
    @ApiResponse(responseCode = "409", description = "admin.slug_taken")
    public AdminCollectionDto update(@PathVariable long id, @Valid @RequestBody CollectionRequest request) {
        return collections.update(id, request);
    }

    @PutMapping("/order")
    @Operation(summary = "Reorder every collection", description = "Returns the list in the new order.")
    @ApiResponse(responseCode = "200", description = "Saved")
    @ApiResponse(responseCode = "400", description = "admin.collection_order: not every collection exactly once")
    public List<AdminCollectionDto> reorder(@Valid @RequestBody CollectionOrderRequest request) {
        return collections.reorder(request);
    }
}
