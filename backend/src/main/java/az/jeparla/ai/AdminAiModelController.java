package az.jeparla.ai;

import az.jeparla.ai.dto.AiModelDto;
import az.jeparla.ai.dto.AiModelImageAttachRequest;
import az.jeparla.ai.dto.AiModelRequest;
import az.jeparla.merchant.dto.ImageUploadDto;
import az.jeparla.merchant.dto.ImageUploadRequest;
import io.swagger.v3.oas.annotations.Operation;
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

/** The AI model library (#130): ADMIN only, every change audited. */
@RestController
@RequestMapping("/api/v1/admin/ai-models")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: AI models", description = "Library of AI models (not real people) for on-model images (ADMIN)")
public class AdminAiModelController {

    private final AdminAiModelService models;

    public AdminAiModelController(AdminAiModelService models) {
        this.models = models;
    }

    @GetMapping
    @Operation(summary = "Every model, inactive too, by sort order")
    public List<AiModelDto> list() {
        return models.list();
    }

    @PostMapping
    @Operation(summary = "Add a model (active, no photos yet)")
    public ResponseEntity<AiModelDto> create(@Valid @RequestBody AiModelRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(models.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Replace a model; active=false deactivates it (it leaves new jobs, approved images stay)")
    public AiModelDto update(@PathVariable long id, @Valid @RequestBody AiModelRequest request) {
        return models.update(id, request);
    }

    @PostMapping("/{id}/default")
    @Operation(summary = "Make the model the default of its audience")
    public AiModelDto makeDefault(@PathVariable long id) {
        return models.makeDefault(id);
    }

    @PostMapping("/{id}/images/uploads")
    @Operation(summary = "Presigned upload URL for one reference photo (JPEG, PNG or WebP, up to 15 MB)")
    public ImageUploadDto upload(@PathVariable long id, @Valid @RequestBody ImageUploadRequest request) {
        return models.upload(id, request);
    }

    @PostMapping("/{id}/images")
    @Operation(summary = "Attach an uploaded reference photo with its pose after checking the stored file")
    public AiModelDto attach(@PathVariable long id, @Valid @RequestBody AiModelImageAttachRequest request) {
        return models.attach(id, request);
    }

    @DeleteMapping("/{id}/images/{imageId}")
    @Operation(summary = "Remove a reference photo")
    public AiModelDto removeImage(@PathVariable long id, @PathVariable long imageId) {
        return models.removeImage(id, imageId);
    }
}
