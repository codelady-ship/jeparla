package az.jeparla.merchant;

import az.jeparla.product.EvidenceKind;

/** What a presigned upload is for (V21): a gallery photo, one kind of evidence photo (#106) or the video (#117). */
enum ImageUploadKind {
    GALLERY,
    HALLMARK,
    TAG,
    /** The short product video (#117, V64). */
    VIDEO;

    static ImageUploadKind of(EvidenceKind kind) {
        return switch (kind) {
            case HALLMARK -> HALLMARK;
            case TAG -> TAG;
        };
    }
}
