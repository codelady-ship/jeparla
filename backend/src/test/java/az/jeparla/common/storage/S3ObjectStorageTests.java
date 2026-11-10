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
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.CopyObjectResponse;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

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
}
