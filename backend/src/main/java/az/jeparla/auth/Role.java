package az.jeparla.auth;

import az.jeparla.common.persistence.LongIdEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/** One of the three roles seeded by V2. Roles are reference data: the API never creates them. */
@Entity
@Table(name = "roles")
public class Role extends LongIdEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "name", nullable = false, unique = true, updatable = false)
    private RoleName name;

    protected Role() {
    }

    public RoleName getName() {
        return name;
    }
}
