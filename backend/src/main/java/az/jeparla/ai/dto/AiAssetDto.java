package az.jeparla.ai.dto;

/**
 * One generated image.
 *
 * @param previewUrl     short-lived private URL while the job waits for review; null once the file is gone
 * @param productImageId the product photo it became on approval, else null
 */
public record AiAssetDto(long id, String previewUrl, int width, int height, Long productImageId) {
}
