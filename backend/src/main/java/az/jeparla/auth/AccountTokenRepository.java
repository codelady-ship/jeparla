package az.jeparla.auth;

import az.jeparla.auth.AccountToken.Purpose;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface AccountTokenRepository extends Repository<AccountToken, Long> {

    AccountToken save(AccountToken token);

    /**
     * Looks a token up by hash and purpose and locks the row, so two requests with the same token cannot both
     * use it: the second one sees it used.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from AccountToken t join fetch t.user where t.tokenHash = :hash and t.purpose = :purpose")
    Optional<AccountToken> findForUpdate(@Param("hash") String hash, @Param("purpose") Purpose purpose);

    /** Marks every open token of a user for one purpose used (the password was reset, the email verified). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update AccountToken t set t.usedAt = :now
            where t.user.id = :userId and t.purpose = :purpose and t.usedAt is null
            """)
    int useAllOf(@Param("userId") Long userId, @Param("purpose") Purpose purpose, @Param("now") Instant now);

    /** Removes rows that expired before {@code before}. */
    @Modifying
    @Query("delete from AccountToken t where t.expiresAt < :before")
    int deleteExpiredBefore(@Param("before") Instant before);
}
