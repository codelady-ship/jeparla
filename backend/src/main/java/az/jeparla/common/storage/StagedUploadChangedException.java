package az.jeparla.common.storage;

/**
 * The staged upload is no longer the object the API checked (#158): it was PUT again with the still valid
 * upload URL, or removed, between the check and the read or the copy. Nothing was published.
 */
public class StagedUploadChangedException extends RuntimeException {

    public StagedUploadChangedException(String key) {
        super("Staged upload changed after its check: " + key);
    }
}
