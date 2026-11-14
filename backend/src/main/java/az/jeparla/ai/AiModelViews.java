package az.jeparla.ai;

import az.jeparla.ai.dto.AiModelDto;
import az.jeparla.ai.dto.AiModelImageDto;
import az.jeparla.common.storage.ImageUrls;
import org.springframework.stereotype.Component;

/** {@link AiModel} as the admin and the seller see it (#130). */
@Component
class AiModelViews {

    private final ImageUrls urls;

    AiModelViews(ImageUrls urls) {
        this.urls = urls;
    }

    AiModelDto view(AiModel model) {
        return new AiModelDto(model.getId(), model.getName(), model.getAudience(), model.getSkinTone(),
                model.getStyle(), model.getOrigin(), model.isActive(), model.isDefault(), model.getSortOrder(),
                model.getImages().stream().map(AiModelImage::getPose).distinct().sorted().toList(),
                model.getImages().stream().map(image -> new AiModelImageDto(image.getId(),
                        urls.url(image.getStorageKey()), image.getPose(), image.getWidth(), image.getHeight()))
                        .toList());
    }
}
