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
| `JEPARLA_INTERNAL_JOB_TOKEN` | boş | `POST /internal/jobs/metal-prices` üçün paylaşılan sirr (ən azı 32 bayt). Boş: endpoint 404. Qısa dəyər tətbiqi başlatmır |
| `JEPARLA_METAL_PRICES_CRON` | `0 15 10,13,17 * * *` | Gündəlik metal qiyməti job-unun cron-u (`Asia/Baku`); `-` söndürür |
| `JEPARLA_TRUSTED_PROXIES` | `127.0.0.1/32,::1/128` | `X-Forwarded-For`-una inanılan reverse proxy-lər (CIDR, vergüllə). Boş: heç kimə inanılmır. Səhv yazılış tətbiqi başlatmır. Aşağıda: "Reverse proxy" |

## Reverse proxy və müştəri IP-si

Rate limit və audit log müştəri IP-sini `ClientIpFilter`-dən alır (#132):

- TCP qarşı tərəfi `JEPARLA_TRUSTED_PROXIES`-də deyilsə, IP onun öz ünvanıdır; `Forwarded`,
  `X-Forwarded-*`, `X-Real-IP` başlıqları nəzərə alınmır.
- Etibarlı proxy-dən gələndə `X-Forwarded-For` sağdan oxunur və etibarlı proxy olmayan ilk ünvan
  müştəridir (soldakı hissəni müştəri özü yaza bilər). `X-Forwarded-Proto` (`http`/`https`) sxemi qoyur
  (HSTS üçün).
- Standart `Forwarded` (RFC 7239) başlığına heç vaxt inanılmır.
- Bu başlıqlar tətbiqin qalan hissəsindən gizlədilir. `server.forward-headers-strategy: none`: Spring-in
  `ForwardedHeaderFilter`-i hər göndərənə inanır və `Forwarded`-i `X-Forwarded-For`-dan üstün tutur.
- IP yalnız IPv4/IPv6 literal kimi parse olunur (`IpAddresses`), host adı heç vaxt DNS-də axtarılmır.
  IPv6 müştərilər rate limit-də /64 şəbəkəsi ilə sayılır.

Prod (#45, Caddy Docker Compose-da):

- `JEPARLA_TRUSTED_PROXIES` yalnız Caddy-nin ünvanı və ya onun şəbəkəsidir. Compose şəbəkəsinin
  subnet-i sabitlənir (məs. `networks: edge: ipam: config: [{subnet: 172.30.0.0/24}]`) və
  `JEPARLA_TRUSTED_PROXIES=172.30.0.0/24`. Bu şəbəkədə Caddy-dən başqa heç nə API-yə sorğu göndərməməlidir.
- API portu host-da açılmır (yalnız Caddy 80/443), əks halda proxy-ni keçən sorğu öz IP-si ilə sayılır
  (təhlükəsiz, amma Caddy-ni də keçir).
- Caddy `X-Forwarded-For`-u özü yazır (gələni üstünə yazır) və müştərinin `Forwarded` başlığını silir:

```caddyfile
api.example.az {
	reverse_proxy backend:8080 {
		# Client-supplied forwarding headers never reach the API.
		header_up -Forwarded
		header_up -X-Real-IP
		header_up X-Forwarded-For {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

Caddy-nin qlobal `trusted_proxies` ayarı **qoyulmur** (Cloudflare və s. qarşıda olmadıqca): onsuz Caddy
müştərinin `X-Forwarded-For`-unu onsuz da atır. Qarşıda CDN olsa, Caddy-də `trusted_proxies` CDN-in
IP diapazonlarına qoyulur və `{remote_host}` əvəzinə `{client_ip}` yazılır.

Yoxlama (deploy sonrası): `Forwarded: for=...` və `X-Forwarded-For` hər sorğuda dəyişdirilərək 21
login sorğusu göndərilir, 21-ci `429` olmalıdır.

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

## Metal qiymətləri və avtomatik qiymət (#43, #44)

**Mənbə (10.11.2026-da yoxlanılıb):** `https://www.cbar.az/currencies/DD.MM.YYYY.xml`. Kök `ValCurs Date="06.11.2026"`
(bülletenin qüvvədə olduğu iş günü), `ValType Type="Bank metalları"` içində `Valute Code="XAU|XAG|XPT|XPD"`,
`Nominal` = `1 t.u.` (troy unsiya), `Value` = AZN, 3-4 onluq (`6877.435`). Həftəsonu və bayram günü istənən tarixə
son bülleten öz tarixi ilə gəlir (31.10.2026 -> `30.10.2026`); mümkün olmayan tarix (`32.13.2026`) 302 ilə ana
səhifəyə yönləndirilir. Nümunələr: `src/test/resources/cbar/`.

- **Job** (`MetalPriceJob`): `jeparla.metal-prices.cron` (default 10:15, 13:15, 17:15, `Asia/Baku`; `-` söndürür).
  Bakı vaxtı ilə bu günün bülletenini alır, `metal_price_snapshots`-a yazır (`price_per_gram` = unsiya / 31.1034768,
  4 onluq), sonra hər metalın istifadədəki kotirovkası ilə bütün canlı METAL_LINKED variantları yenidən qiymətləndirir.
  ShedLock (`shedlock` cədvəli, V11, baza vaxtı) iki instansiyanın eyni anda işləməsinə imkan vermir; kilid
  tutulubsa run heç nə etmir. Hər run bir xülasə log sətri (`Metal price job (...)`) və Micrometer sayğacları
  (`jeparla.metal_prices.fetch|quotes|repriced`) yazır.
- **İdempotent:** bir metalın bir günlük CBAR kotirovkası bir dəfə saxlanılır (unikal indeks); həmin kotirovka ilə
  artıq qiymətlənmiş variant ötürülür. İkinci run heç nəyi dəyişmir, ikinci `price_history` sətri yazmır.
- **Yoxlama:** bülletendə metal yoxdursa, təkrarlanırsa, `0`/mənfi/qeyri-adi format, başqa vahid, gələcək və ya
  30 gündən köhnə tarix varsa bütün bülleten rədd edilir, son düzgün qiymət qalır. Şəbəkə xətası, 5xx və 429
  `attempts` dəfə (default 3) artan fasilə ilə təkrarlanır; redirect izlənmir; timeout-lar `connect-timeout`,
  `read-timeout`. User-Agent: `Jeparla/1.0 (metal price service; +https://jeparla.az)`.
- **Sanity check:** istifadədəki qiymətə nisbətən dəyişmə (bir onluq, admin panelindəki kimi) `max-daily-change-percent`-dən
  (10) böyükdürsə kotirovka `HELD` saxlanılır, `METAL PRICE HELD` xəbərdarlığı loglanır, heç nə qiymətləndirmir və
  ictimai API-də görünmür, admin qərar verənə qədər köhnə qiymət qalır.
- **Formula** (`PricingEngine`, `frontend/src/lib/pricing.ts` ilə eyni): metal = çəki x (əyar/1000) x qram qiyməti,
  işçilik = çəki x qram başına + sabit, qiymət = (metal + işçilik + daş) x (1 + əlavə/100), sonra min, sonra max,
  sonda `HALF_UP` 2 onluq. Yalnız `BigDecimal`. Paritet: `node backend/src/test/resources/pricing/generate.mjs`
  `pricing.ts`-in özünü işlədib `pricing-cases.json` yaradır (428 hal), `PricingEngineParityTests` hər hissəni
  müqayisə edir. `pricing.ts` dəyişəndə yenidən yaradın və commit edin.
- **Qiymət tarixçəsi:** qiyməti dəyişən variant üçün `price_history` (`METAL_PRICE`, kotirovka, əvvəlki qiymət);
  dəyişməyən variant yalnız yeni kotirovkaya və "son yenilənmə" vaxtına keçir. FIXED variantlara toxunulmur.
  Hesablana bilməyən variant (məs. başqa valyuta) `failed` sayılır və köhnə qiymətini saxlayır; bazada xəta verən
  batch variant-variant təkrarlanır. Satıcı qaydanı dəyişəndə (#39) qiyməti `PricingEngine` ilə dərhal hesablamalıdır:
  job eyni kotirovka ilə qiymətlənmiş variantı ötürür.
- **Keş:** server keşi yoxdur; kataloq cavablarının CDN keşi `s-maxage=300`, metal qiymətləri `s-maxage=3600` ilə köhnəlir.

| Endpoint | Təsvir |
| --- | --- |
| `GET /api/v1/admin/metal-prices` | ADMIN: hər metalın istifadədəki qiyməti, əvvəlki, dəyişmə, `held` kotirovka (`AdminMetalPrice`) |
| `PATCH /api/v1/admin/metal-prices/{metal}/held` | ADMIN: `{action: accept\|discard, reason}`; discard üçün səbəb 10-500 simvol; tətbiq edilib dərhal yenidən qiymətləndirir; audit |
| `PUT /api/v1/admin/metal-prices/{metal}` | ADMIN: `{pricePerOunce, reason, confirmLarge}` əl ilə qiymət (`source: ADMIN`, bu günün tarixi); limitdən böyük dəyişmə `confirmLarge` olmadan 409 `metal_prices.large_change`; eyni gün təkrar düzəltmək olar (ən yenisi qüvvədədir); növbəti CBAR bülleteni onu əvəz edir; audit |
| `POST /internal/jobs/metal-prices` | `X-Jeparla-Job-Token: $JEPARLA_INTERNAL_JOB_TOKEN` ilə job-u indi işlədir (idempotent, eyni kilid); token yoxdursa 404, səhvdirsə 401, job işləyirsə 409. Reverse proxy `/internal/*`-i API-yə ötürməlidir |

**Mənbə dəyəri:** `MetalPrice.source` `CBAR` (gündəlik bülleten) və ya `ADMIN` (əl ilə override) ola bilər; frontend
tipində hələ yalnız `"CBAR"` var (#41-də `"CBAR" | "ADMIN"` olmalıdır).

**Gündəlik yoxlama** (`.github/workflows/metal-prices-check.yml`, hər gün 14:30 Bakı): repo dəyişəni `JEPARLA_API_URL`
və secret `JEPARLA_INTERNAL_JOB_TOKEN` ilə `latest` tarixini AMB bülleteninin tarixi ilə müqayisə edir, köhnədirsə
endpoint-i çağırır, yenə köhnədirsə və ya admin təsdiqi gözləyən qiymət varsa issue açır (açıq olanı yeniləyir).

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
- Variantın əyarı məhsulun metalındandır (V10, #122): `product_variants.metal` əyardan trigger ilə doldurulur,
  kompozit FK-lar onu `finenesses (id, metal)` və `products (id, metal)` ilə eyni saxlayır. Məhsulun metalını
  dəyişmək üçün variantların əyarı eyni tranzaksiyada dəyişməlidir (FK commit-də yoxlanılır).
- Koordinatlar `NUMERIC(9,6)`: `Store.setGeo` `Decimals.coordinate` ilə 6 onluğa gətirir, artığını yuvarlaqlaşdırmır,
  xəta verir (#126); xəritədən gələn dəyəri çağıran tərəf yuvarlaqlaşdırır.

## CI (`.github/workflows/backend.yml`, #35)

- `gradle build`: bütün testlər (Testcontainers runner-in Docker-ində). Job summary testləri sayır
  (`.github/scripts/junit_summary.py`); CI-da bir test belə skipped olarsa job qırmızıdır. JUnit XML və HTML
  hesabatı `backend-test-results` artifact-ındadır.
- `old-name sweep`: `python3 tools/sweep.py backend --config docs/brand.json`.
- `secret scan`: gitleaks (versiya və SHA-256 workflow-da sabitdir) PR-ın commit-lərini yoxlayır; qaydalar `.gitleaks.toml`.
- Asılılıq yeniləmələri: Dependabot (`.github/dependabot.yml`, Gradle və GitHub Actions, həftəlik).
