# Jeparla backend

Jeparla REST API: Java 21, Spring Boot 4.1, Gradle (Kotlin DSL, wrapper repoda).
PostgreSQL 16 məcburidir: tətbiq başlayanda Flyway `src/main/resources/db/migration` miqrasiyalarını tətbiq edir.
JPA entity-ləri #33 ilə gəlir. Lokal baza üçün kökdəki README-yə baxın (`docker compose up -d postgres`).

## Qaldırma

JDK 21 lazımdır (`JAVA_HOME`) və işləyən PostgreSQL 16 (`JEPARLA_DB_*` dəyişənləri).

```bash
cd backend
./gradlew bootRun          # Windows: gradlew.bat bootRun
./gradlew build            # kompilyasiya + testlər + boot jar
```

- Sağlamlıq: http://localhost:8080/actuator/health
- OpenAPI: http://localhost:8080/v3/api-docs
- Swagger UI: http://localhost:8080/swagger-ui.html

Az RAM-lı maşında: `./gradlew build --no-daemon` (Gradle JVM `gradle.properties`-də 1 GB ilə məhduddur).

Docker (Docker olan maşında, `backend/` qovluğundan; amd64 və arm64 üçün):

```bash
docker build -t jeparla-backend .
docker run --rm -p 8080:8080 -e JEPARLA_FRONTEND_ORIGIN=http://localhost:3000 \
  -e JEPARLA_DB_URL=jdbc:postgresql://host.docker.internal:5432/jeparla \
  -e JEPARLA_DB_USER=jeparla -e JEPARLA_DB_PASSWORD=... jeparla-backend
```

## Mühit dəyişənləri

Sirlər yalnız mühitdən gəlir, repoda heç bir açar yoxdur.

| Dəyişən | Default | Təsvir |
| --- | --- | --- |
| `PORT` | `8080` | HTTP portu |
| `JEPARLA_FRONTEND_ORIGIN` | `http://localhost:3000` | `/api/**` üçün icazəli frontend origin-ləri, vergüllə (məs. `https://jeparla.az,https://www.jeparla.az`). `*`, path və ya http(s) olmayan dəyər tətbiqi başlatmır |
| `JEPARLA_DB_URL` | `jdbc:postgresql://localhost:5432/jeparla` | PostgreSQL JDBC URL |
| `JEPARLA_DB_USER` | `jeparla` | Baza istifadəçisi (miqrasiyalar üçün bazanın sahibi olmalıdır) |
| `JEPARLA_DB_PASSWORD` | boş | Baza şifrəsi |

## Qaydalar

- Paketlər funksiyaya görə: `az.jeparla.<feature>` (`auth`, `store`, `product`, `search`,
  `pricing`, `verification`, `admin`, `common`), hər birində `dto/`.
- Xəta formatı: RFC 9457 `ProblemDetail` (`application/problem+json`). `title` və `detail`
  `Accept-Language` üzrə az (default), en, ru dilindədir; validasiya xətalarında `errors`
  massivi (`field`, `message`) olur. Mətnlər `src/main/resources/messages*.properties`-dədir,
  üç fayl sinxron saxlanılır.
- Pul və çəki yalnız `BigDecimal` (DB-də `NUMERIC`); `float`/`double` qadağandır.
- Sxem yalnız Flyway ilə dəyişir: tətbiq olunmuş miqrasiya faylı redaktə edilmir, yeni `V<N>__<ad>.sql` əlavə olunur.
  Pul `NUMERIC(12,2)` + `currency CHAR(3)`, çəki `NUMERIC(8,3)`, vaxt `TIMESTAMPTZ`; lokallaşdırılmış mətn
  `*_az` (məcburi), `*_en`, `*_ru` sütunlarıdır. Məhsul silinmir (`status` + `deleted_at`, DB trigger-i qoruyur).
- Testlər: `@WithPostgres` Spring testlərinə Testcontainers ilə PostgreSQL 16 verir. Docker olmayan maşında
  bu testlər keçilir (skipped), CI-da isə məcburi işləyir (`DockerInCiTests`).
