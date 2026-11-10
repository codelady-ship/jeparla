package az.jeparla.common.storage;

import java.net.URI;
import java.time.Duration;
import java.util.Arrays;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;

/**
 * {@link ObjectStorage} on an S3-compatible API with the AWS SDK v2. Path-style URLs
 * ({@code endpoint/bucket/key}) work on both MinIO and Cloudflare R2. Checksums are only sent where the
 * API requires them: R2 and MinIO do not support every checksum the SDK adds by default.
 *
 * <p>Uploads are staged in the private bucket under {@value ObjectStorage#STAGING_PREFIX} and reach the
 * public bucket only after their check ({@link #publishStaged}: a server-side copy, the API never downloads
 * the file).
 */
public class S3ObjectStorage implements ObjectStorage, AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(S3ObjectStorage.class);

    private final S3Client client;
    private final S3Presigner presigner;
    private final String publicBucket;
    private final String privateBucket;

    /** Set once the storage answered a conditional copy with 501, so the warning is logged once. */
    private final AtomicBoolean conditionalCopyUnsupported = new AtomicBoolean();

    public S3ObjectStorage(S3Properties properties) {
        this(client(properties), presigner(properties), properties.publicBucket(), properties.privateBucket());
    }

    /** For tests: a given client (the presigner is only used by {@link #presignStagedUpload}). */
    S3ObjectStorage(S3Client client, S3Presigner presigner, String publicBucket, String privateBucket) {
        this.client = client;
        this.presigner = presigner;
        this.publicBucket = publicBucket;
        this.privateBucket = privateBucket;
    }

    private static S3Client client(S3Properties properties) {
        if (!properties.configured()) {
            throw new IllegalArgumentException("S3 storage is not configured: " + properties);
        }
        return S3Client.builder()
                .endpointOverride(URI.create(properties.endpoint()))
                .region(Region.of(properties.region()))
                .credentialsProvider(credentials(properties))
                .serviceConfiguration(pathStyle())
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .httpClient(UrlConnectionHttpClient.builder()
                        .connectionTimeout(Duration.ofSeconds(5))
                        .socketTimeout(Duration.ofSeconds(20))
                        .build())
                .build();
    }

    private static S3Presigner presigner(S3Properties properties) {
        return S3Presigner.builder()
                .endpointOverride(URI.create(properties.browserEndpoint()))
                .region(Region.of(properties.region()))
                .credentialsProvider(credentials(properties))
                .serviceConfiguration(pathStyle())
                .build();
    }

    private static StaticCredentialsProvider credentials(S3Properties properties) {
        return StaticCredentialsProvider.create(
                AwsBasicCredentials.create(properties.accessKey(), properties.secretKey()));
    }

    private static S3Configuration pathStyle() {
        return S3Configuration.builder().pathStyleAccessEnabled(true).build();
    }

    @Override
    public PresignedUpload presignStagedUpload(String key, String contentType, long sizeBytes, Duration ttl) {
        PutObjectRequest put = PutObjectRequest.builder()
                .bucket(privateBucket)
                .key(STAGING_PREFIX + key)
                .contentType(contentType)
                .contentLength(sizeBytes)
                .build();
        PresignedPutObjectRequest presigned = presigner.presignPutObject(
                request -> request.signatureDuration(ttl).putObjectRequest(put));
        return new PresignedUpload(presigned.url().toString(), "PUT", Map.of("Content-Type", contentType),
                presigned.expiration());
    }

    @Override
    public Optional<StoredObject> headStaged(String key) {
        try {
            HeadObjectResponse response = client.headObject(
                    HeadObjectRequest.builder().bucket(privateBucket).key(STAGING_PREFIX + key).build());
            return Optional.of(new StoredObject(response.contentLength(), response.contentType(), response.eTag()));
        } catch (NoSuchKeyException e) {
            return Optional.empty();
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                return Optional.empty();
            }
            throw e;
        }
    }

    @Override
    public byte[] readStagedStart(String key, StoredObject checked, int maxBytes) {
        GetObjectRequest.Builder request = GetObjectRequest.builder()
                .bucket(privateBucket)
                .key(STAGING_PREFIX + key)
                .range("bytes=0-" + (maxBytes - 1));
        if (checked.etag() != null) {
            request.ifMatch(checked.etag());
        }
        byte[] bytes;
        try {
            bytes = client.getObjectAsBytes(request.build()).asByteArray();
        } catch (S3Exception e) {
            if (changed(e)) {
                throw new StagedUploadChangedException(key);
            }
            throw e;
        }
        // A server that ignores Range sends the whole object.
        return bytes.length <= maxBytes ? bytes : Arrays.copyOf(bytes, maxBytes);
    }

    /**
     * Two guards against a file PUT again with the still valid upload URL after the check (#158): a HEAD right
     * before the copy (same ETag and size; also covers a storage that ignores the copy condition) and the copy
     * itself conditional on the checked ETag ({@code x-amz-copy-source-if-match}). A storage that answers the
     * condition with 501 gets an unconditional copy, guarded by the HEAD only.
     */
    @Override
    public void publishStaged(String key, StoredObject checked) {
        StoredObject current = headStaged(key).orElseThrow(() -> new StagedUploadChangedException(key));
        if (current.sizeBytes() != checked.sizeBytes() || !Objects.equals(current.etag(), checked.etag())) {
            throw new StagedUploadChangedException(key);
        }
        // Both buckets are in one account: a server-side copy, content type and length are kept.
        CopyObjectRequest copy = CopyObjectRequest.builder()
                .sourceBucket(privateBucket)
                .sourceKey(STAGING_PREFIX + key)
                .destinationBucket(publicBucket)
                .destinationKey(key)
                .build();
        try {
            if (checked.etag() == null || conditionalCopyUnsupported.get()) {
                client.copyObject(copy);
            } else {
                copyIfMatch(copy, checked.etag());
            }
        } catch (S3Exception e) {
            if (changed(e)) {
                throw new StagedUploadChangedException(key);
            }
            throw e;
        }
        try {
            deleteStaged(key);
        } catch (RuntimeException e) {
            log.warn("Published {} but could not delete its staged copy: {}", key, e.toString());
        }
    }

    private void copyIfMatch(CopyObjectRequest copy, String etag) {
        try {
            client.copyObject(copy.toBuilder().copySourceIfMatch(etag).build());
        } catch (S3Exception e) {
            if (e.statusCode() != 501) {
                throw e;
            }
            if (conditionalCopyUnsupported.compareAndSet(false, true)) {
                log.warn("Storage does not support a conditional CopyObject (501): publishing after a HEAD check only");
            }
            client.copyObject(copy);
        }
    }

    /** 412: the ETag no longer matches; 404: the staged object is gone. */
    private static boolean changed(S3Exception e) {
        return e instanceof NoSuchKeyException || e.statusCode() == 412 || e.statusCode() == 404;
    }

    @Override
    public void deleteStaged(String key) {
        client.deleteObject(DeleteObjectRequest.builder().bucket(privateBucket).key(STAGING_PREFIX + key).build());
    }

    @Override
    public void delete(String key) {
        client.deleteObject(DeleteObjectRequest.builder().bucket(publicBucket).key(key).build());
    }

    @Override
    public void close() {
        presigner.close();
        client.close();
    }
}
