package az.jeparla.common.storage;

import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
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
 */
public class S3ObjectStorage implements ObjectStorage, AutoCloseable {

    private final S3Client client;
    private final S3Presigner presigner;
    private final String bucket;

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
        this.bucket = properties.publicBucket();
    }

    @Override
    public PresignedUpload presignUpload(String key, String contentType, long sizeBytes, Duration ttl) {
        PutObjectRequest put = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .contentLength(sizeBytes)
                .build();
        PresignedPutObjectRequest presigned = presigner.presignPutObject(
                request -> request.signatureDuration(ttl).putObjectRequest(put));
        return new PresignedUpload(presigned.url().toString(), "PUT", Map.of("Content-Type", contentType),
                presigned.expiration());
    }

    @Override
    public Optional<StoredObject> head(String key) {
        try {
            HeadObjectResponse response = client.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build());
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
    public byte[] readStart(String key, int maxBytes) {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .range("bytes=0-" + (maxBytes - 1))
                .build();
        byte[] bytes = client.getObjectAsBytes(request).asByteArray();
        // A server that ignores Range sends the whole object.
        return bytes.length <= maxBytes ? bytes : java.util.Arrays.copyOf(bytes, maxBytes);
    }

    @Override
    public void delete(String key) {
        client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
    }

    @Override
    public void close() {
        presigner.close();
        client.close();
    }
}
