package az.jeparla.merchant;

import az.jeparla.product.EvidenceKind;

/** What a presigned photo upload is for (V21): a gallery photo or one kind of evidence photo (#106). */
enum ImageUploadKind {
    GALLERY,
    HALLMARK,
    TAG;

    static ImageUploadKind of(EvidenceKind kind) {
        return switch (kind) {
            case HALLMARK -> HALLMARK;
            case TAG -> TAG;
        };
    }
}
