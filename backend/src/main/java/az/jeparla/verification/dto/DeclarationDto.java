package az.jeparla.verification.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The declaration a precious-metal seller confirms before uploading a document (#138). The frontend shows
 * {@code text} next to an unticked checkbox and sends {@code version} back with the upload. {@code draft} is
 * true until a lawyer approves the wording (#57).
 */
@Schema(name = "SellerDeclaration", requiredProperties = {"version", "language", "text", "draft"})
public record DeclarationDto(String version, String language, String text, boolean draft) {
}
