package az.jeparla.common.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ImageUrlsTests {

    private static ImageUrls urls(String publicUrl) {
        return new ImageUrls(new StorageProperties(publicUrl));
    }

    @Test
    void demoKeysLoseTheFragmentAndPointToTheFrontendDemoFolder() {
        ImageUrls urls = urls("https://img.jeparla.az");
        assertThat(urls.url("demo/ring-gold-1.jpg#12-0")).isEqualTo("/demo/ring-gold-1.jpg");
        assertThat(urls.url("demo/necklace-silver-2.jpg#4-1")).isEqualTo("/demo/necklace-silver-2.jpg");
        assertThat(urls.url("demo/ring-gold-1.jpg")).isEqualTo("/demo/ring-gold-1.jpg");
    }

    @Test
    void demoKeysNeedNoBucketUrl() {
        assertThat(urls(null).url("demo/ring-gold-1.jpg#12-0")).isEqualTo("/demo/ring-gold-1.jpg");
        assertThat(urls("").url("demo/ring-gold-1.jpg#1-0")).isEqualTo("/demo/ring-gold-1.jpg");
    }

    @Test
    void bucketKeysAreAppendedToThePublicUrlWithTheirSlashes() {
        assertThat(urls("https://img.jeparla.az").url("products/12/a1b2c3.webp"))
                .isEqualTo("https://img.jeparla.az/products/12/a1b2c3.webp");
        assertThat(urls("http://localhost:9000/jeparla-public/").url("stores/3/logo.png"))
                .isEqualTo("http://localhost:9000/jeparla-public/stores/3/logo.png");
    }

    @Test
    void bucketKeysNeverContainAFragment() {
        assertThatThrownBy(() -> urls("https://img.jeparla.az").url("products/12/a.webp#1"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void bucketKeysNeedTheBucketUrl() {
        assertThatThrownBy(() -> urls(null).url("products/12/a.webp")).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JEPARLA_S3_PUBLIC_URL");
    }

    @Test
    void noKeyNoUrl() {
        assertThat(urls(null).url(null)).isNull();
    }

    @Test
    void theBucketUrlMustBeHttp() {
        assertThatThrownBy(() -> new StorageProperties("ftp://img.jeparla.az")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new StorageProperties("https://img.jeparla.az/?x=1"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new StorageProperties("not a url")).isInstanceOf(IllegalArgumentException.class);
    }
}
