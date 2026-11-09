package az.jeparla.auth;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends Repository<RefreshToken, Long> {

    RefreshToken save(RefreshToken token);

    /**
     * Looks a token up by hash and locks the row, so two concurrent refreshes with the same token
     * cannot both succeed: the second one sees it used and triggers reuse detection.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from RefreshToken t join fetch t.user where t.tokenHash = :hash")
    Optional<RefreshToken> findByTokenHashForUpdate(@Param("hash") String hash);

    Optional<RefreshToken> findByTokenHash(String hash);

    List<RefreshToken> findByFamilyIdOrderByIdAsc(UUID familyId);

    /** Revokes every token of a family that is not revoked yet. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update RefreshToken t set t.revokedAt = :now where t.familyId = :familyId and t.revokedAt is null")
    int revokeFamily(@Param("familyId") UUID familyId, @Param("now") Instant now);

    /** Revokes every token of a user (account blocked, password changed). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update RefreshToken t set t.revokedAt = :now where t.user.id = :userId and t.revokedAt is null")
    int revokeAllOfUser(@Param("userId") Long userId, @Param("now") Instant now);

    /** Removes rows that expired before {@code before}; reuse of them can no longer matter. */
    @Modifying
    @Query("delete from RefreshToken t where t.expiresAt < :before")
    int deleteExpiredBefore(@Param("before") Instant before);
}
