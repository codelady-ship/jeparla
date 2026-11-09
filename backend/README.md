# Jeparla backend

Jeparla REST API: Java 21, Spring Boot 4.1, Gradle (Kotlin DSL, wrapper repoda).
PostgreSQL 16 məcburidir: tətbiq başlayanda Flyway `src/main/resources/db/migration` miqrasiyalarını tətbiq edir,
sonra Hibernate JPA entity-lərini sxemə qarşı yoxlayır (`ddl-auto: validate`; sxemi yalnız Flyway dəyişir).
Lokal baza üçün kökdəki README-yə baxın (`docker compose up -d postgres`).

## Demo məlumat

`demo` profili boş bazaya frontend fixture-ları ilə eyni nümunə kataloqu yükləyir
(`frontend/src/lib/api/mock/fixtures.ts`: 6 mağaza, 12 kateqoriya, 6 əyar, 60 məhsul, eyni id, slug və qiymətlər):

```bash
SPRING_PROFILES_ACTIVE=demo ./gradlew bootRun
```

Seed `src/main/resources/db/demo/R__demo_seed.sql`-dir və yalnız `demo` profilində Flyway-ə qoşulur
(`application-demo.yml`); prod-da heç vaxt işə düşmür. Bütün məlumat uydurmadır (telefonlar `+994 50 000 00 0X`,
VÖEN `000000000X`), demo satıcılar daxil ola bilmir. Kataloq boş deyilsə seed heç nə etmir; dəyişmiş seed-i
yükləmək üçün bazanı yenidən yaradın (`docker compose down -v`).

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
| `JEPARLA_JWT_SECRET` | yoxdur (məcburi) | Access token-lərin HS256 açarı, ən azı 32 bayt (`openssl rand -hex 32`). Yoxdursa və ya qısadırsa tətbiq başlamır |
| `JEPARLA_COOKIE_SECURE` | `true` | Refresh cookie-nin `Secure` bayrağı |
| `JEPARLA_REDIS_HOST` / `JEPARLA_REDIS_PORT` / `JEPARLA_REDIS_PASSWORD` | `localhost` / `6379` / boş | Rate limit sayğacları. Redis yoxdursa API işləyir, sayğaclar yaddaşa keçir |
| `JEPARLA_S3_PUBLIC_URL` | boş | Public bucket-in brauzer URL-i (məs. `https://img.jeparla.az`); şəkil URL-i = bu dəyər + `/` + açar. Demo şəkillər (`demo/...`) üçün lazım deyil |

## İctimai kataloq API (#37)

Hamısı anonim `GET`-dir, cavablar `frontend/src/types/api.ts` tipləri ilə eynidir (Swagger: `/swagger-ui.html`).

| Endpoint | Cavab |
| --- | --- |
| `GET /api/v1/products` | `Page<ProductSummary>`; filtrlər `ProductFilters` ilə eyni: `q`, `category`, `store` (çoxlu), `metal`, `fineness` (çoxlu), `minWeight`/`maxWeight`, `minPrice`/`maxPrice`, `verified`, `inStock`, `city`, `shape`/`color`/`clarity` (çoxlu), `minCarat`/`maxCarat`, `sort` (`relevance`, `newest`, `price_asc`, `price_desc`, `weight_asc`), `page` (0-dan), `size` (1-96, default 24) |
| `GET /api/v1/products?ids=1,2` | `ProductSummary[]` (seçilmişlər), soruşulan sırada, ən çox 100 |
| `GET /api/v1/products/{slug}` | `Product` və ya 404 |
| `GET /api/v1/variants?ids=10,20` | `CompareItem[]` (müqayisə), ən çox 4 |
| `GET /api/v1/categories`, `/finenesses` | `Category[]` (say alt kateqoriyalarla), `Fineness[]` |
| `GET /api/v1/stores?q=&city=`, `/stores/{slug}`, `/stores/{slug}/products` | `StoreSummary[]`, `Store`, `Page<ProductSummary>` |
| `GET /api/v1/metal-prices/latest`, `/metal-prices/history?metal=GOLD&days=30` | `MetalPrice[]` (yalnız `APPLIED` kotirovkalar) |
| `POST /api/v1/products/{id}/contact-click` | 204; WhatsApp klik statistikası (`product_contact_clicks`, gün üzrə), qonaq da olar |
| `POST /api/v1/products/{id}/reports` | 204; `{reason, message?}` şikayət, qonaq da olar, `report-ip`/`report-account` limiti |

- **Görünən məhsul:** `APPROVED`, silinməyib, mağazası `APPROVED`, kateqoriyası və bütün üst kateqoriyaları aktivdir və ən azı bir canlı variantı var. Qalan hər şey bütün endpoint-lərdə (siyahı, səhifə, ids, müqayisə, saylar, şikayət, klik) yoxdur və ya 404-dür. Deaktiv kateqoriyanın məhsulları gizlənir.
- **Kart dəyərləri:** default variant ən ucuz canlı variantdır: `priceFrom`, `defaultVariantId`, `pricingMode`, `fineness`, `weightGrams` ondan gəlir; `stockStatus` variantların ən yaxşısıdır. Qiymət filtri və sıralama `priceFrom`-a görədir, çəki və əyar filtri hər hansı canlı variantla uyğunlaşır.
- **Sabit səhifələmə:** hər sıralama sonda məhsul id-si ilə bitir; son səhifədən sonrakı səhifə boşdur, saylar qalır.
- **Dil:** məlumat həmişə üç dildə (`{az, en, ru}`) gəlir; `Accept-Language` yalnız xəta mətnini dəyişir. Pul `{amount: "1248.50", currency}`, çəki və karat sətir kimi.
- **Keş:** `Cache-Control: public, max-age, s-maxage, stale-while-revalidate` (CDN üçün; `CachePolicy`) və ETag (`If-None-Match` -> 304). Xətalar `no-store`-dur.
- **Şəkil URL-i:** `demo/ring-gold-1.jpg#12-0` açarı `/demo/ring-gold-1.jpg` olur (frontend-in `public/demo` qovluğu, fraqment atılır); qalan açarlar `JEPARLA_S3_PUBLIC_URL/<açar>`, onlarda `#` ola bilməz (V9 CHECK).
- **Kontrakt testi:** `CatalogContractTests` frontend `http.ts`-in göndərdiyi sorğunu backend-ə verir və cavabı frontend mock-unun eyni çağırışa cavabı ilə müqayisə edir (açarlar, JSON tipləri, dəyərlər). Fixture-lar frontend kodundan yaradılır: `node backend/src/test/resources/contract/generate.mjs` (repo kökündən; `frontend/node_modules` lazımdır). Tiplər, mock və ya demo məlumat dəyişəndə yenidən yaradın və commit edin.

## Giriş və icazələr

Ətraflı: [docs/RBAC.md](../docs/RBAC.md).

| Endpoint | Təsvir |
| --- | --- |
| `POST /api/v1/auth/register` | alıcı: `{name, email, password}`, 201 |
| `POST /api/v1/auth/register/merchant` | satıcı: `{name, phone, email?, password}`, 201 |
| `POST /api/v1/auth/login` | `{login, password}`; `login` e-poçt və ya telefon |
| `POST /api/v1/auth/refresh` | refresh cookie ilə yeni access token, cookie rotasiya olunur |
| `POST /api/v1/auth/logout` | sessiyanı ləğv edir, cookie-ni silir, 204 |
| `GET /api/v1/auth/me` | daxil olmuş istifadəçi |

Uğurlu cavab: `{accessToken, tokenType: "Bearer", expiresIn, user: {id, name, email, phone, role, roles, locale}}`
və `Set-Cookie: jeparla_refresh=...; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict`.
Xətalarda ProblemDetail-də `code` sahəsi var (`auth.invalid_credentials`, `auth.email_taken`,
`auth.refresh_invalid`, `auth.forbidden`, `rate_limited` ...); 429-da `Retry-After`.

Lokal sınaq (Git Bash):

```bash
curl -i -X POST localhost:8080/api/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Aysel","email":"aysel@example.az","password":"parol123"}'
```

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
- JPA: entity-lər öz funksiya paketindədir (`auth`, `store`, `product`, `pricing`, `verification`, `admin`).
  Pul/çəki `BigDecimal` sütunun scale-i ilə (`Decimals`: artıq onluq rəqəm yuvarlaqlaşdırılmır, xəta verir),
  valyuta `java.util.Currency` (`CHAR(3)`), lokallaşdırılmış mətn `@Embeddable LocalizedText`, enum-lar
  `@Enumerated(STRING)`, `search_text` yalnız oxunur, vaxt `Instant`. Məhsul, variant, qiymət tarixçəsi və audit log
  repository-lərində delete metodu yoxdur (`NoDeleteRepository`); məhsul `Product.softDelete` ilə "silinir".
- Sahiblik: `findByIdAndOwnerId` / `findByIdAndStoreOwnerId` sorğuları başqa satıcının resursu üçün boş qaytarır.
- Kataloq siyahısı N+1 etmir: mağaza və kateqoriya `join fetch`, şəkillər və variantlar
  `hibernate.default_batch_fetch_size` ilə paketlə yüklənir (`ProductRepositoryTests` sorğu sayını yoxlayır).
  `spring.jpa.open-in-view: false`: entity-lər `@Transactional` servisdə DTO-ya çevrilir.
- Rol və sahiblik backend-də: URL qaydaları (`SecurityConfig`), servisdə `@PreAuthorize`, satıcı
  resursları üçün `StoreAccess.requireOwner(id)` / `ProductAccess.requireOwner(id)` (403 başqasının, 404 yoxdur).
  İstifadəçi id-si yalnız `CurrentUser.id()`-dən (token `sub`). Admin və satıcı əməliyyatları `AuditService.record`.
- Gözlənilən xətalar `ApiException` (status + `code`, mətn `error.<code>` açarından 3 dildə).
- Testlər: `@WithPostgres` Spring testlərinə Testcontainers ilə PostgreSQL 16 verir; `@AuthIntegrationTest`
  üstəlik Redis 7 konteyneri və qorunan test endpoint-ləri qoşur. Test JWT açarı `src/test/resources/config/application.yml`-dədir. Docker olmayan maşında
  bu testlər keçilir (skipped), CI-da isə məcburi işləyir (`DockerInCiTests`).
