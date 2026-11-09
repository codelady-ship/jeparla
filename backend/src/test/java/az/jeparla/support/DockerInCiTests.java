package az.jeparla.support;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.testcontainers.DockerClientFactory;

/**
 * Database tests skip themselves without Docker. In CI that would hide them, so CI must have Docker.
 */
class DockerInCiTests {

    @Test
    @EnabledIfEnvironmentVariable(named = "CI", matches = "true")
    void dockerIsAvailableInCi() {
        assertThat(DockerClientFactory.instance().isDockerAvailable())
                .as("CI must run the Testcontainers tests, not skip them")
                .isTrue();
    }
}
