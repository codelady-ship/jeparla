# syntax=docker/dockerfile:1
# Jeparla API image. Multi-stage, multi-arch (amd64 and arm64: the production VM is ARM).
# Build from backend/:  docker build -t jeparla-backend .

# ---- Build stage: compile and package the boot jar ----
FROM eclipse-temurin:21-jdk-noble AS build
WORKDIR /workspace

# Gradle wrapper and build scripts first, so dependency resolution is cached between builds.
COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties ./
COPY gradle gradle
RUN chmod +x gradlew
RUN --mount=type=cache,target=/root/.gradle ./gradlew dependencies --no-daemon -q > /dev/null

COPY src src
# Tests run in CI; the image build only packages.
RUN --mount=type=cache,target=/root/.gradle ./gradlew bootJar --no-daemon -x test

# Split the jar into layers (dependencies change less often than application code).
RUN java -Djarmode=tools -jar build/libs/jeparla-backend.jar extract --layers --launcher --destination extracted

# ---- Runtime stage: JRE only, non-root ----
FROM eclipse-temurin:21-jre-noble
WORKDIR /app

RUN groupadd --system jeparla && useradd --system --gid jeparla --no-create-home --shell /usr/sbin/nologin jeparla

COPY --from=build --chown=jeparla:jeparla /workspace/extracted/dependencies/ ./
COPY --from=build --chown=jeparla:jeparla /workspace/extracted/spring-boot-loader/ ./
COPY --from=build --chown=jeparla:jeparla /workspace/extracted/snapshot-dependencies/ ./
COPY --from=build --chown=jeparla:jeparla /workspace/extracted/application/ ./

USER jeparla

# Configuration and secrets come only from the environment (see README.md).
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError" \
    PORT=8080
EXPOSE 8080

ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
