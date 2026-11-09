package az.jeparla.db;

import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.admin.AuditLogRepository;
import az.jeparla.common.persistence.NoDeleteRepository;
import az.jeparla.pricing.PriceHistoryRepository;
import az.jeparla.product.ProductReportRepository;
import az.jeparla.product.ProductRepository;
import az.jeparla.product.ProductVariantRepository;
import az.jeparla.support.JpaTest;
import jakarta.persistence.EntityManagerFactory;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.hibernate.engine.spi.SessionFactoryImplementor;
import org.hibernate.metamodel.MappingMetamodel;
import org.hibernate.persister.collection.AbstractCollectionPersister;
import org.hibernate.persister.entity.AbstractEntityPersister;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The JPA mapping covers the whole Flyway schema (#33). The context only starts when Hibernate
 * {@code validate} accepts every entity against the migrated database, so these tests passing
 * means the validation passed.
 */
@JpaTest
class JpaMappingTests {

    @Autowired
    private EntityManagerFactory emf;

    @Autowired
    private JdbcTemplate jdbc;

    @Value("${spring.jpa.hibernate.ddl-auto}")
    private String ddlAuto;

    @Test
    void hibernateOnlyValidatesTheFlywaySchema() {
        assertThat(ddlAuto).isEqualTo("validate");
    }

    @Test
    void everyTableIsMapped() {
        MappingMetamodel metamodel = emf.unwrap(SessionFactoryImplementor.class).getMappingMetamodel();
        Set<String> mapped = new HashSet<>();
        metamodel.forEachEntityDescriptor(entity -> mapped.add(((AbstractEntityPersister) entity).getTableName()));
        metamodel.forEachCollectionDescriptor(collection -> {
            if (collection.isManyToMany()) {
                mapped.add(((AbstractCollectionPersister) collection).getTableName());
            }
        });

        List<String> tables = jdbc.queryForList("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'flyway_schema_history'
                """, String.class);
        assertThat(tables).hasSize(16);
        assertThat(mapped).containsExactlyInAnyOrderElementsOf(tables);
    }

    @Test
    void demoSeedIsNotLoadedWithoutTheDemoProfile() {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE script LIKE '%demo%'",
                Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE email LIKE 'demo-merchant-%'", Long.class))
                .isZero();
    }

    @ParameterizedTest
    @ValueSource(classes = {ProductRepository.class, ProductVariantRepository.class, PriceHistoryRepository.class,
            AuditLogRepository.class, ProductReportRepository.class})
    void historyAndProductRepositoriesCannotDelete(Class<?> repository) {
        List<String> deleting = Arrays.stream(repository.getMethods())
                .map(Method::getName)
                .filter(name -> name.startsWith("delete") || name.startsWith("remove"))
                .toList();
        assertThat(deleting).as(repository.getSimpleName()).isEmpty();
    }

    @Test
    void noDeleteRepositoryExposesNoDelete() {
        assertThat(Arrays.stream(NoDeleteRepository.class.getMethods()).map(Method::getName))
                .noneMatch(name -> name.startsWith("delete"));
    }
}
