package az.jeparla.common.storage;

import org.springframework.stereotype.Component;

/**
 * Turns a public storage key ({@code product_images.storage_key}, {@code stores.logo_key}) into the
 * URL a browser loads.
 *
 * <ul>
 *   <li>Demo keys ({@code demo/...}, loaded only by the demo seed) are the free photos shipped with
 *       the frontend in {@code frontend/public/demo}. The seed reuses 16 files for many unique keys
 *       by adding a fragment ({@code demo/ring-gold-1.jpg#12-0}); the fragment is dropped and the URL
 *       is the frontend path {@code /demo/ring-gold-1.jpg}, relative to the frontend origin, exactly
 *       as the frontend mock returns it. No fragment ever reaches a response, JSON-LD or og:image.</li>
 *   <li>Every other key is an object in the public bucket: {@code JEPARLA_S3_PUBLIC_URL + "/" + key},
 *       with the slashes of the key kept (keys are generated, URL-safe paths). Such keys never contain
 *       {@code #}; the database checks it too (V9).</li>
 * </ul>
 */
@Component
public class ImageUrls {

    static final String DEMO_PREFIX = "demo/";

    private final String publicUrl;

    public ImageUrls(StorageProperties properties) {
        this.publicUrl = properties.publicUrl();
    }

    /** URL of {@code key}, or null for a null key (e.g. a store without a logo). */
    public String url(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        if (key.startsWith(DEMO_PREFIX)) {
            int fragment = key.indexOf('#');
            String file = key.substring(DEMO_PREFIX.length(), fragment < 0 ? key.length() : fragment);
            return "/demo/" + file;
        }
        if (key.indexOf('#') >= 0) {
            throw new IllegalArgumentException("Storage keys outside demo/ must not contain '#': " + key);
        }
        if (publicUrl == null) {
            throw new IllegalStateException("jeparla.storage.public-url (JEPARLA_S3_PUBLIC_URL) is not set");
        }
        return publicUrl + "/" + (key.startsWith("/") ? key.substring(1) : key);
    }

    /**
     * The public bucket key of a URL made by {@link #url}, or empty for a demo path or any other URL. Lets a local
     * processor read a photo from storage instead of fetching a URL (#119).
     */
    public java.util.Optional<String> key(String url) {
        if (url == null || publicUrl == null || !url.startsWith(publicUrl + "/")) {
            return java.util.Optional.empty();
        }
        String key = url.substring(publicUrl.length() + 1);
        return key.isEmpty() || key.indexOf('#') >= 0 || key.contains("..") ? java.util.Optional.empty()
                : java.util.Optional.of(key);
    }
}
