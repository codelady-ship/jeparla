package az.jeparla.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Whether search by photo works (#163). The header shows the camera button disabled with the reason while
 * {@code configured} is false.
 *
 * @param configured an embedding model is installed
 * @param maxBytes   largest photo accepted
 */
@Schema(name = "ImageSearchStatus")
public record ImageSearchStatusDto(boolean configured, int maxBytes) {
}
