package az.jeparla.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    /** Login by email: case-insensitive, uses the {@code lower(email)} unique index. Roles loaded. */
    @EntityGraph(attributePaths = "roles")
    @Query("select u from User u where lower(u.email) = lower(:email)")
    Optional<User> findByEmailIgnoringCase(@Param("email") String email);

    /** Login by E.164 phone. Roles loaded. */
    @EntityGraph(attributePaths = "roles")
    Optional<User> findByPhone(String phone);

    @EntityGraph(attributePaths = "roles")
    @Query("select u from User u where u.id = :id")
    Optional<User> findWithRolesById(@Param("id") Long id);

    @Query("select count(u) > 0 from User u where lower(u.email) = lower(:email)")
    boolean existsByEmailIgnoringCase(@Param("email") String email);

    boolean existsByPhone(String phone);

    // ------------------------------------------------------------------ admin (#40)

    /** Active accounts with the ADMIN role in the database (not just in a token). */
    @Query("""
            select count(distinct u) from User u join u.roles r
            where r.name = az.jeparla.auth.RoleName.ADMIN and u.status = az.jeparla.auth.UserStatus.ACTIVE
            """)
    long countActiveAdmins();

    /**
     * Locks the ADMIN role row until the transaction ends: role and status changes that could remove the last
     * active admin run one after another, and each counts the admins after the previous one committed.
     */
    @Query(value = "SELECT id FROM roles WHERE name = 'ADMIN' FOR UPDATE", nativeQuery = true)
    Long lockAdminRole();
}
