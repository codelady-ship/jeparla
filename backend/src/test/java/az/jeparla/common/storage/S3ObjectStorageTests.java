package az.jeparla.common.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.jeparla.common.storage.ObjectStorage.StoredObject;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.http.AbortableInputStream;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.CopyObjectResponse;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/** The copy to the public bucket happens only for the staged object the API checked (#158). */
class S3ObjectStorageTests {

    private static final String KEY = "products/1/2/0b8f3c52-6c36-4c0e-9a51-2f8f0c3a8d11.png";
    private static final StoredObject CHECKED = new StoredObject(1000, "image/png", "\"abc\"");

    private final S3Client client = mock(S3Client.class);
    private final S3ObjectStorage storage = new S3ObjectStorage(client, null, "public", "private");

    private void headReturns(long size, String etag) {
        when(client.headObject(any(HeadObjectRequest.class))).thenReturn(
                HeadObjectResponse.builder().contentLength(size).contentType("image/png").eTag(etag).build());
    }

    private static S3Exception status(int code) {
        return (S3Exception) S3Exception.builder().statusCode(code).message("status " + code).build();
    }

    @Test
    void theCopyIsConditionalOnTheCheckedEtag() {
        headReturns(1000, "\"abc\"");
        storage.publishStaged(KEY, CHECKED);
        ArgumentCaptor<CopyObjectRequest> copy = ArgumentCaptor.forClass(CopyObjectRequest.class);
        verify(client).copyObject(copy.capture());
        assertThat(copy.getValue().copySourceIfMatch()).isEqualTo("\"abc\"");
        assertThat(copy.getValue().sourceBucket()).isEqualTo("private");
        assertThat(copy.getValue().sourceKey()).isEqualTo(ObjectStorage.STAGING_PREFIX + KEY);
        assertThat(copy.getValue().destinationBucket()).isEqualTo("public");
        verify(client).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test
    void anObjectReplacedBeforeTheCopyIsNotCopied() {
        for (HeadObjectResponse head : List.of(
                HeadObjectResponse.builder().contentLength(1000L).eTag("\"other\"").build(),
                HeadObjectResponse.builder().contentLength(999L).eTag("\"abc\"").build())) {
            when(client.headObject(any(HeadObjectRequest.class))).thenReturn(head);
            assertThatThrownBy(() -> storage.publishStaged(KEY, CHECKED))
                    .isInstanceOf(StagedUploadChangedException.class);
        }
        when(client.headObject(any(HeadObjectRequest.class))).thenThrow(status(404));
        assertThatThrownBy(() -> storage.publishStaged(KEY, CHECKED)).isInstanceOf(StagedUploadChangedException.class);
        verify(client, never()).copyObject(any(CopyObjectRequest.class));
    }

    @Test
    void aFailedCopyConditionIsAChange() {
        headReturns(1000, "\"abc\"");
        when(client.copyObject(any(CopyObjectRequest.class))).thenThrow(status(412));
        assertThatThrownBy(() -> storage.publishStaged(KEY, CHECKED)).isInstanceOf(StagedUploadChangedException.class);
        verify(client, never()).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test
    void aStorageWithoutConditionalCopyIsGuardedByTheHeadOnly() {
        headReturns(1000, "\"abc\"");
        when(client.copyObject(any(CopyObjectRequest.class)))
                .thenThrow(status(501))
                .thenReturn(CopyObjectResponse.builder().build());
        storage.publishStaged(KEY, CHECKED);
        ArgumentCaptor<CopyObjectRequest> copies = ArgumentCaptor.forClass(CopyObjectRequest.class);
        verify(client, times(2)).copyObject(copies.capture());
        assertThat(copies.getAllValues().get(1).copySourceIfMatch()).isNull();

        // Later copies skip the condition, the HEAD still refuses a replaced object.
        headReturns(1000, "\"other\"");
        assertThatThrownBy(() -> storage.publishStaged(KEY, CHECKED)).isInstanceOf(StagedUploadChangedException.class);
        verify(client, times(2)).copyObject(any(CopyObjectRequest.class));
    }

    @Test
    void otherCopyErrorsAreNotAChange() {
        headReturns(1000, "\"abc\"");
        when(client.copyObject(any(CopyObjectRequest.class))).thenThrow(status(500));
        assertThatThrownBy(() -> storage.publishStaged(KEY, CHECKED)).isInstanceOf(S3Exception.class)
                .isNotInstanceOf(StagedUploadChangedException.class);
    }

    @Test
    void theProbeReadsOnlyTheCheckedObject() {
        when(client.getObjectAsBytes(any(GetObjectRequest.class))).thenReturn(
                ResponseBytes.fromByteArray(GetObjectResponse.builder().build(), new byte[] {1, 2, 3, 4}));
        assertThat(storage.readStagedStart(KEY, CHECKED, 2)).containsExactly(1, 2);
        ArgumentCaptor<GetObjectRequest> get = ArgumentCaptor.forClass(GetObjectRequest.class);
        verify(client).getObjectAsBytes(get.capture());
        assertThat(get.getValue().ifMatch()).isEqualTo("\"abc\"");
        assertThat(get.getValue().range()).isEqualTo("bytes=0-1");

        when(client.getObjectAsBytes(any(GetObjectRequest.class))).thenThrow(status(412));
        assertThatThrownBy(() -> storage.readStagedStart(KEY, CHECKED, 2))
                .isInstanceOf(StagedUploadChangedException.class);
    }

    // ------------------------------------------------------------------ private documents (#40)

    private static final String DOCUMENT = "documents/7/0b8f3c52-6c36-4c0e-9a51-2f8f0c3a8d11.pdf";

    @Test
    void aDocumentIsCopiedIntoThePrivateBucketOnly() {
        headReturns(1000, "\"abc\"");
        storage.keepStagedPrivate(DOCUMENT, CHECKED);
        ArgumentCaptor<CopyObjectRequest> copy = ArgumentCaptor.forClass(CopyObjectRequest.class);
        verify(client).copyObject(copy.capture());
        assertThat(copy.getValue().sourceBucket()).isEqualTo("private");
        assertThat(copy.getValue().sourceKey()).isEqualTo(ObjectStorage.STAGING_PREFIX + DOCUMENT);
        assertThat(copy.getValue().destinationBucket()).isEqualTo("private");
        assertThat(copy.getValue().destinationKey()).isEqualTo(DOCUMENT);
        assertThat(copy.getValue().copySourceIfMatch()).isEqualTo("\"abc\"");
    }

    @Test
    void theHashIsOfTheCheckedObjectAndItsWholeSize() throws Exception {
        byte[] bytes = "%PDF-1.7 test".getBytes(StandardCharsets.US_ASCII);
        StoredObject checked = new StoredObject(bytes.length, "application/pdf", "\"abc\"");
        when(client.getObject(any(GetObjectRequest.class))).thenAnswer(invocation -> new ResponseInputStream<>(
                GetObjectResponse.builder().build(), AbortableInputStream.create(new ByteArrayInputStream(bytes))));
        assertThat(storage.sha256Staged(DOCUMENT, checked))
                .isEqualTo(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)));
        ArgumentCaptor<GetObjectRequest> get = ArgumentCaptor.forClass(GetObjectRequest.class);
        verify(client).getObject(get.capture());
        assertThat(get.getValue().bucket()).isEqualTo("private");
        assertThat(get.getValue().key()).isEqualTo(ObjectStorage.STAGING_PREFIX + DOCUMENT);
        assertThat(get.getValue().ifMatch()).isEqualTo("\"abc\"");

        // Fewer bytes than were checked: the object changed in between.
        StoredObject bigger = new StoredObject(bytes.length + 1, "application/pdf", "\"abc\"");
        assertThatThrownBy(() -> storage.sha256Staged(DOCUMENT, bigger))
                .isInstanceOf(StagedUploadChangedException.class);
    }

    @Test
    void anAdminLinkIsShortLivedAndDownloadsFromThePrivateBucket() {
        try (S3Presigner presigner = S3Presigner.builder()
                .region(Region.of("auto"))
                .endpointOverride(URI.create("https://storage.example.test"))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("id", "secret")))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build()) {
            S3ObjectStorage signing = new S3ObjectStorage(client, presigner, "public", "private");
            ObjectStorage.PresignedDownload download = signing.presignPrivateDownload(DOCUMENT, "application/pdf",
                    "VÖEN \"çıxarış\".pdf", Duration.ofMinutes(5));
            assertThat(download.url())
                    .startsWith("https://storage.example.test/private/" + DOCUMENT)
                    .contains("X-Amz-Expires=300")
                    .contains("response-content-disposition=attachment")
                    .doesNotContain("/public/");
            assertThat(download.expiresAt()).isBefore(Instant.now().plusSeconds(301));
        }
        assertThat(S3ObjectStorage.asciiFileName("VÖEN \"çıxarış\".pdf")).isEqualTo("V_EN ___xar___.pdf");
        assertThat(S3ObjectStorage.asciiFileName("")).isEqualTo("document");
    }

    @Test
    void deletingAPrivateDocumentNeverTouchesStaging() {
        storage.deletePrivate(DOCUMENT);
        ArgumentCaptor<DeleteObjectRequest> delete = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(client).deleteObject(delete.capture());
        assertThat(delete.getValue().bucket()).isEqualTo("private");
        assertThat(delete.getValue().key()).isEqualTo(DOCUMENT);
        assertThatThrownBy(() -> storage.deletePrivate(ObjectStorage.STAGING_PREFIX + DOCUMENT))
                .isInstanceOf(IllegalArgumentException.class);
        verify(client, times(1)).deleteObject(any(DeleteObjectRequest.class));
    }
}
