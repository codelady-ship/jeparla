package az.jeparla.common.storage;

import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
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

    public S3ObjectStorage(S3Properties properties) {
        if (!properties.configured()) {
            throw new IllegalArgumentException("S3 storage is not configured: " + properties);
        }
        StaticCredentialsProvider credentials = StaticCredentialsProvider.create(
                AwsBasicCredentials.create(properties.accessKey(), properties.secretKey()));
        S3Configuration pathStyle = S3Configuration.builder().pathStyleAccessEnabled(true).build();
        Region region = Region.of(properties.region());
        this.client = S3Client.builder()
                .endpointOverride(URI.create(properties.endpoint()))
                .region(region)
                .credentialsProvider(credentials)
                .serviceConfiguration(pathStyle)
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .httpClient(UrlConnectionHttpClient.builder()
                        .connectionTimeout(Duration.ofSeconds(5))
                        .socketTimeout(Duration.ofSeconds(20))
                        .build())
                .build();
        this.presigner = S3Presigner.builder()
                .endpointOverride(URI.create(properties.browserEndpoint()))
                .region(region)
                .credentialsProvider(credentials)
                .serviceConfiguration(pathStyle)
                .build();
        this.publicBucket = properties.publicBucket();
        this.privateBucket = properties.privateBucket();
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
            return Optional.of(new StoredObject(response.contentLength(), response.contentType()));
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
    public byte[] readStagedStart(String key, int maxBytes) {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(privateBucket)
                .key(STAGING_PREFIX + key)
                .range("bytes=0-" + (maxBytes - 1))
                .build();
        byte[] bytes = client.getObjectAsBytes(request).asByteArray();
        // A server that ignores Range sends the whole object.
        return bytes.length <= maxBytes ? bytes : java.util.Arrays.copyOf(bytes, maxBytes);
    }

    @Override
    public void publishStaged(String key) {
        // Both buckets are in one account: a server-side copy, content type and length are kept.
        client.copyObject(CopyObjectRequest.builder()
                .sourceBucket(privateBucket)
                .sourceKey(STAGING_PREFIX + key)
                .destinationBucket(publicBucket)
                .destinationKey(key)
                .build());
        try {
            deleteStaged(key);
        } catch (RuntimeException e) {
            log.warn("Published {} but could not delete its staged copy: {}", key, e.toString());
        }
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
