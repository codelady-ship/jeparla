plugins {
    java
    id("org.springframework.boot") version "4.1.2"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "az.jeparla"
version = "0.0.1-SNAPSHOT"
description = "Jeparla REST API"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

// springdoc-openapi 3.x targets Spring Boot 4; 3.2.0 is built against Boot 4.1.2.
val springdocVersion = "3.2.0"
// ShedLock 7.x targets Spring Framework 7 / Boot 4.
val shedlockVersion = "7.10.1"
// AWS SDK v2 for S3-compatible storage (Cloudflare R2, MinIO locally): presigned uploads and object checks (#39).
val awsSdkVersion = "2.56.0"

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:$springdocVersion")
    // PostgreSQL + Flyway migrations at startup (#32); JPA entities are validated against them (#33).
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    implementation("org.flywaydb:flyway-database-postgresql")
    runtimeOnly("org.postgresql:postgresql")
    // Auth (#34): Spring Security, JWT access tokens (resource server, HS256 via Nimbus), and Redis
    // for the rate-limit counters (the API falls back to in-memory counters when Redis is down).
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-security-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    // Short-lived in-process cache of search rankings and suggestions (#151); version from the Boot BOM.
    implementation("com.github.ben-manes.caffeine:caffeine")
    // Daily metal price job (#44): one run across instances (ShedLock, JDBC lock table from V12).
    implementation("net.javacrumbs.shedlock:shedlock-core:$shedlockVersion")
    implementation("net.javacrumbs.shedlock:shedlock-provider-jdbc-template:$shedlockVersion")
    // Product image uploads (#39): presigned PUT URLs, then HEAD and a ranged GET to check the stored file.
    // The JDK URLConnection client only: no Netty or Apache HTTP client on the classpath.
    implementation(platform("software.amazon.awssdk:bom:$awsSdkVersion"))
    implementation("software.amazon.awssdk:s3") {
        exclude(group = "software.amazon.awssdk", module = "netty-nio-client")
        exclude(group = "software.amazon.awssdk", module = "apache-client")
        exclude(group = "software.amazon.awssdk", module = "apache5-client")
    }
    implementation("software.amazon.awssdk:url-connection-client")
    // Email outbox (#131): plain-text mail through any SMTP relay (provider in docs/deploy.md, keys in env only).
    implementation("org.springframework.boot:spring-boot-starter-mail")

    annotationProcessor("org.springframework.boot:spring-boot-configuration-processor")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.testcontainers:testcontainers-junit-jupiter")
    testImplementation("org.testcontainers:testcontainers-postgresql")
    testImplementation("org.springframework.security:spring-security-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<JavaCompile> {
    options.encoding = "UTF-8"
    options.compilerArgs.add("-parameters")
}

tasks.test {
    useJUnitPlatform()
    maxHeapSize = "768m"
    // Print every test with its result, so CI logs show that the Testcontainers tests ran
    // (they are skipped on machines without Docker).
    testLogging {
        events("passed", "skipped", "failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }
}

tasks.bootJar {
    archiveFileName = "jeparla-backend.jar"
}

tasks.jar {
    // Only the executable boot jar is built.
    enabled = false
}
