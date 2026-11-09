package az.jeparla.auth;

import java.util.Optional;
import org.springframework.data.repository.Repository;

/** Roles are seeded by V2 and read only. */
public interface RoleRepository extends Repository<Role, Long> {

    Optional<Role> findByName(RoleName name);
}
