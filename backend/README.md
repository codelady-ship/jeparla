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

OpenAPI və Swagger UI yalnız `JEPARLA_API_DOCS=true` ilə açılır (`JEPARLA_API_DOCS=true ./gradlew bootRun`);
default söndürülüb və prod-da 404 verir (#134).

Az RAM-lı maşında: `./gradlew build --no-daemon` (Gradle JVM `gradle.properties`-də 1 GB ilə məhduddur).

Docker (Docker olan maşında, `backend/` qovluğundan; amd64 və arm64 üçün):

```bash
docker build -t jeparla-backend .
docker run --rm -p 8080:8080 -e JEPARLA_FRONTEND_ORIGIN=http://localhost:3000 \
  -e JEPARLA_DB_URL=jdbc:postgresql://host.docker.internal:5432/jeparla \
  -e JEPARLA_DB_MIGRATION_USER=jeparla_owner -e JEPARLA_DB_MIGRATION_PASSWORD=... \
  -e JEPARLA_DB_USER=jeparla_app -e JEPARLA_DB_PASSWORD=... jeparla-backend
```

## Mühit dəyişənləri

Sirlər yalnız mühitdən gəlir, repoda heç bir açar yoxdur.

| Dəyişən | Default | Təsvir |
| --- | --- | --- |
| `PORT` | `8080` | HTTP portu |
| `JEPARLA_FRONTEND_ORIGIN` | `http://localhost:3000` | `/api/**` üçün icazəli frontend origin-ləri, vergüllə (məs. `https://jeparla.az,https://www.jeparla.az`). `*`, path və ya http(s) olmayan dəyər tətbiqi başlatmır |
| `JEPARLA_DB_URL` | `jdbc:postgresql://localhost:5432/jeparla` | PostgreSQL JDBC URL |
| `JEPARLA_DB_MIGRATION_USER` / `JEPARLA_DB_MIGRATION_PASSWORD` | `jeparla_owner` / boş | Miqrasiya rolu: sxemin sahibi, yalnız Flyway qoşulur (`spring.flyway.user`). Superuser olmamalıdır. Aşağıda: "Verilənlər bazası rolları" |
| `JEPARLA_DB_USER` / `JEPARLA_DB_PASSWORD` | `jeparla_app` / boş | API-nin iş rolu: superuser deyil, heç nəyin sahibi deyil, sübut cədvəllərində yalnız `SELECT`, `INSERT` (V16). Miqrasiya rolu ilə eyni olsa, superuser və ya sahib olsa API başlamır |
| `JEPARLA_SUPPORT_EMAIL` / `JEPARLA_SUPPORT_URL` | boş | "Dəstəyə yazın" deyən bildirişlərin (saytda və e-poçtda) sonunda göstərilən dəstək ünvanı (#138); URL mütləq `http(s)` olmalıdır. Hər ikisi boşdursa saytdakı kömək səhifəsi yazılır: saytda alıcının dilində yol (`/az/help`), e-poçtda tam URL (`JEPARLA_PUBLIC_SITE_URL` + `/az/help`, #167). Prod-da biri məcburi təyin olunur. Səhv dəyər tətbiqi başlatmır |
| `JEPARLA_JWT_SECRET` | yoxdur (məcburi) | Access token-lərin HS256 açarı, ən azı 32 bayt (`openssl rand -hex 32`). Yoxdursa və ya qısadırsa tətbiq başlamır |
| `JEPARLA_COOKIE_SECURE` | `true` | Refresh cookie-nin `Secure` bayrağı |
| `JEPARLA_REDIS_HOST` / `JEPARLA_REDIS_PORT` / `JEPARLA_REDIS_PASSWORD` | `localhost` / `6379` / boş | Rate limit sayğacları (yalnız onlar; `maxmemory-policy noeviction`, #134). Redis yoxdursa API işləyir, sayğaclar yaddaşa keçir. Axtarış keşi API-nin yaddaşındadır (`jeparla.search.cache`, 60 san., #151) |
| `JEPARLA_API_DOCS` | `false` | `true`: `/v3/api-docs` və Swagger UI açılır (yalnız lokal). Default-da hər ikisi 404 (#134) |
| `JEPARLA_S3_PUBLIC_URL` | boş | Public bucket-in brauzer URL-i (məs. `https://img.jeparla.az`); şəkil URL-i = bu dəyər + `/` + açar. Demo şəkillər (`demo/...`) üçün lazım deyil |
| `JEPARLA_S3_ENDPOINT` | boş | Satıcı şəkilləri üçün S3 uyğun API (R2: `https://<account>.r2.cloudflarestorage.com`, lokal MinIO). Boş və ya açar yoxdursa yükləmə endpoint-ləri `503 storage.unavailable` qaytarır, qalan API işləyir |
| `JEPARLA_S3_PRESIGN_ENDPOINT` | boş (`JEPARLA_S3_ENDPOINT`) | Presigned URL-ə yazılan host (brauzer açır). Docker Compose-da `http://localhost:9000`, çünki API MinIO-ya `minio:9000` ilə gedir |
| `JEPARLA_S3_REGION` | `us-east-1` | R2 üçün `auto` |
| `JEPARLA_S3_ACCESS_KEY` / `JEPARLA_S3_SECRET_KEY` | boş | Bucket açarları (yalnız env-də; logda maskalanır) |
| `JEPARLA_S3_PUBLIC_BUCKET` | `jeparla-public` | Məhsul şəkillərinin bucket-i (public oxunur) |
| `JEPARLA_S3_PRIVATE_BUCKET` | `jeparla-private` | Private bucket: yüklənən şəkil yoxlanana qədər `staging/` altında gözləyir (#154), sənədlər (#40). Public bucket ilə eyni olsa tətbiq başlamır; boşdursa yükləmə `503` |
| `JEPARLA_UPLOAD_CLEANUP_CRON` | `0 7/30 * * * *` | Qoşulmamış yükləmələrin (şəkil və sənəd) təmizlənməsi (hər 30 dəq.); `-` söndürür |
| `JEPARLA_EMAIL_OUTBOX_CRON` | `0 * * * * *` | E-poçt növbəsinin göndərilməsi (#138). `JEPARLA_SMTP_HOST` boşdursa heç nə göndərilmir, məktublar `PENDING` qalır; `-` söndürür |
| `JEPARLA_PUBLIC_SITE_URL` | `http://localhost:3000` | Frontend-in ictimai origin-i (path-sız, məs. `https://jeparla.az`): e-poçtdakı linklər bununla qurulur (təsdiq, şifrə bərpası, kömək səhifəsi), həmçinin mağazanın paylaşım linki `/s/<kod>` və onun QR kodu (#100). Path, query və ya http(s) olmayan dəyər tətbiqi başlatmır |
| `JEPARLA_SMTP_HOST` / `JEPARLA_SMTP_PORT` | boş / `587` | E-poçt növbəsinin SMTP relay-i (#131), STARTTLS məcburidir. Boş: heç nə göndərilmir. Aşağıda: "E-poçt göndərmə" |
| `JEPARLA_SMTP_USERNAME` / `JEPARLA_SMTP_PASSWORD` | boş | Provayderin SMTP login-i və parolu/API açarı (yalnız env-də; logda maskalanır) |
| `JEPARLA_MAIL_FROM` | boş | Göndərən, məs. `Jeparla <no-reply@jeparla.az>`; host varsa məcburidir (yoxdursa tətbiq başlamır). Domen provayderdə SPF/DKIM ilə təsdiqlənməlidir |
| `JEPARLA_ACCOUNT_TOKEN_CLEANUP_CRON` | `0 40 * * * *` | Vaxtı keçmiş təsdiq/bərpa tokenlərinin silinməsi və növbədəki vaxtı keçmiş linklərin məktubdan çıxarılması (saatda bir); `-` söndürür |
| `JEPARLA_INTERNAL_JOB_TOKEN` | boş | `POST /internal/jobs/metal-prices` üçün paylaşılan sirr (ən azı 32 bayt). Boş: endpoint 404. Qısa dəyər tətbiqi başlatmır |
| `JEPARLA_METAL_PRICES_CRON` | `0 15 10,13,17 * * *` | Gündəlik metal qiyməti job-unun cron-u (`Asia/Baku`); `-` söndürür |
| `JEPARLA_TRUSTED_PROXIES` | `127.0.0.1/32,::1/128` | `X-Forwarded-For`-una inanılan reverse proxy-lər (CIDR, vergüllə). Boş: heç kimə inanılmır. Səhv yazılış tətbiqi başlatmır. Aşağıda: "Reverse proxy" |
| `JEPARLA_FRONTEND_TOKEN` | boş | Frontend serverinin paylaşılan sirri (ən azı 32 bayt, frontend-də eyni dəyər). Next.js serveri ziyarətçi adından API-yə gedəndə (giriş, axtarış) bu token ilə `X-Jeparla-Client-Ip` başlığında ziyarətçinin IP-sini yazır; rate limit və audit həmin IP ilə sayılır (#41). Boş: başlıq nəzərə alınmır. Qısa dəyər tətbiqi başlatmır |

## Verilənlər bazası rolları (#165)

API bazaya cədvəllərin sahibi və ya superuser kimi qoşulmur: satıcı bəyanatı (`seller_declarations`) və
audit log hüquqi sübutdur, sahib isə trigger-i söndürə (`ALTER TABLE ... DISABLE TRIGGER`), superuser bütün
trigger-ləri keçə (`SET session_replication_role = replica`) bilər. Qaydalar və cədvəl: [docs/RBAC.md](../docs/RBAC.md),
"Verilənlər bazası rolları".

- **Miqrasiya rolu** (`JEPARLA_DB_MIGRATION_USER`, default `jeparla_owner`): bazanın (və `public` sxeminin) sahibi,
  superuser deyil. Yalnız Flyway onunla, eyni `JEPARLA_DB_URL`-ə qoşulur.
- **İş rolu** (`JEPARLA_DB_USER`, default `jeparla_app`): `LOGIN`, `NOSUPERUSER`, heç nəyin sahibi deyil. Hüquqlarını
  V16 verir (Flyway placeholder-i `runtimerole` = `spring.datasource.username`): adi cədvəllərdə CRUD, sübut
  cədvəllərində yalnız `SELECT`, `INSERT`; sonrakı miqrasiyaların cədvəlləri default privileges ilə gəlir.
- V16 rol yoxdursa, miqrasiya rolu ilə eynidirsə, superuser-dirsə və ya cədvəl sahibidirsə dayanır; API başlayanda
  `DatabaseRoleCheck` eyni şeyi yoxlayır (log: `Database runtime role checked`).

**Docker Compose:** `docker/postgres/10-jeparla-roles.sh` boş volume-un ilk başlanğıcında hər iki rolu yaradır
(`.env`: `JEPARLA_DB_ADMIN_PASSWORD` konteynerin `postgres` superuser-i üçün, `JEPARLA_DB_MIGRATION_PASSWORD`,
`JEPARLA_DB_PASSWORD`). Backend konteyneri superuser parolunu almır.

**Docker-siz** (superuser kimi, parollar `.env`-dən):

```sql
CREATE ROLE jeparla_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '...';
CREATE ROLE jeparla_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '...';
CREATE DATABASE jeparla OWNER jeparla_owner;
REVOKE ALL ON DATABASE jeparla FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE jeparla TO jeparla_app;
```

**Prod (#45, Oracle VM, Docker Compose):** eyni compose faylı; üç parol serverdəki `.env`-də (600) və GitHub
Secrets-dədir, bir-birindən fərqlidir. Superuser parolu yalnız `postgres` servisinə verilir. Backup (#56)
miqrasiya rolu və ya superuser ilə alınır və bərpa olunur; bərpadan sonra cədvəllərin sahibi yenə miqrasiya
rolu olmalıdır (`pg_restore --no-owner --role=jeparla_owner`).
Deploy-dan sonra yoxlama: `SELECT rolsuper FROM pg_roles WHERE rolname = current_user` iş rolu ilə `f`,
`TRUNCATE seller_declarations` iş rolu ilə `permission denied` (compose CI eyni yoxlamanı edir).

**Mövcud baza (V15-ə qədər tək istifadəçi ilə qurulub):** lokal bazanı yenidən yaratmaq kifayətdir
(`docker compose down -v`, sonra `up`). Saxlanmalı bazada köhnə istifadəçi (o vaxtkı `JEPARLA_DB_USER`, Docker-də
superuser) ilə bir dəfə:

```sql
CREATE ROLE jeparla_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '...';
CREATE ROLE jeparla_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '...';
ALTER DATABASE jeparla OWNER TO jeparla_owner;
REVOKE ALL ON DATABASE jeparla FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE jeparla TO jeparla_app;
-- Cədvəllər (identity sequence-ləri onlarla birlikdə keçir) və Jeparla funksiyaları yeni sahibə.
DO $$
DECLARE o record;
BEGIN
    FOR o IN SELECT c.oid::regclass AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') LOOP
        EXECUTE format('ALTER TABLE %s OWNER TO jeparla_owner', o.name);
    END LOOP;
    FOR o IN SELECT p.oid::regprocedure AS name FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public'
               AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') LOOP
        EXECUTE format('ALTER ROUTINE %s OWNER TO jeparla_owner', o.name);
    END LOOP;
END $$;
```

Sonra `.env`-də `JEPARLA_DB_MIGRATION_USER/PASSWORD` və `JEPARLA_DB_USER=jeparla_app` / `JEPARLA_DB_PASSWORD`
yazılır, API yenidən başladılır: Flyway V16-nı sahib rolu ilə tətbiq edir. Köhnə istifadəçi həmin volume-un
superuser-i olaraq qalır, onun parolu `JEPARLA_DB_ADMIN_PASSWORD`-dur və API-yə verilmir.

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
| `GET /api/v1/products?ids=1,2` | `ProductSummary[]` (seçilmişlər), soruşulan sırada, ən çox 100; boş elementlər atılır (`ids=,` -> `[]`), müsbət tam ədəd olmayan id 400-dür (`catalog.invalid_ids`, #141) |
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
  ShedLock (`shedlock` cədvəli, V12) iki instansiyanın eyni anda işləməsinə imkan vermir; kilid
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
hər ikisini tanıyır və `ADMIN` qiymətini saytda "administrator düzəlişi" kimi göstərir (#41).

**Gündəlik yoxlama** (`.github/workflows/metal-prices-check.yml`, hər gün 14:30 Bakı): repo dəyişəni `JEPARLA_API_URL`
və secret `JEPARLA_INTERNAL_JOB_TOKEN` ilə `latest` tarixini AMB bülleteninin tarixi ilə müqayisə edir, köhnədirsə
endpoint-i çağırır, yenə köhnədirsə və ya admin təsdiqi gözləyən qiymət varsa issue açır (açıq olanı yeniləyir).

## Axtarış API (#38)

| Endpoint | Cavab |
| --- | --- |
| `GET /api/v1/search?q=&type=&page=&size=` | `SearchResult`: `products` (`Page`, default 24), `stores`, `categories` (səhifəsiz, hər biri ən çox 100). `type`: `all` (default), `products`, `stores`, `categories`; seçilməyən qruplar boşdur. Növ üzrə say: `products.totalElements`, `stores.length`, `categories.length` |
| `GET /api/v1/search/suggest?q=` | `Suggestions`: hər qrupda ən çox 5 (mağaza, kateqoriya, məhsul `priceFrom` ilə); boş `q` üçün qruplar boşdur |

- **Uyğunluq:** sorğu `jeparla_fold` qaydası ilə qatlanır (`SearchText.fold`), ilk 8 söz götürülür, hər söz uyğun gəlməlidir (AND). Söz mətnin sözüdürsə, sözün başlanğıcıdırsa, sinonimi (`search_synonyms`, V11) sözün başlanğıcıdırsa və ya (3+ hərf) trigram `word_similarity` >= 0.5-dirsə uyğundur: `qizil` = `qızıl`, `uzk` = `üzük`, `кольцо` = `Кольца`, `serqa` = `sırğa`. Mətn: məhsul adları (az/en/ru), kateqoriya adı, mağaza adı; mağazada ad və şəhər; kateqoriyada üç dildə ad.
- **Sıralama** (`SearchSql`): söz üçün tam söz 1.0, başlanğıc 0.8, sinonim 0.7, səhv yazı ən çox 0.6 (0.6 x oxşarlıq), sözlər üzrə orta. Məhsulda kateqoriya adında tapılan söz x0.75, mağaza adında x0.5. Mağaza və ya kateqoriya adı sorğunun özüdürsə +1.0, onunla başlayırsa +0.5 (mağaza adı ilə axtarışda mağaza birincidir); məhsul adı sorğu ilə başlayırsa +0.3, sorğu ardıcıl sözlər kimi içindədirsə +0.2. Bərabərlikdə: məhsul və mağaza id, kateqoriya admin sırası.
- **Yalnız ictimai olan:** kataloqdakı kimi (görünən məhsul, `APPROVED` mağaza, görünən kateqoriya). Boş (və ya hərfsiz) `q`: hər şey kataloq sırası ilə (frontend mock kimi).
- **Limitlər:** `q` ən çox 100 simvol, `page` 0-10000, `size` 1-96; səhv dəyər 400 ProblemDetail (`errors`, 3 dildə). `search-ip` rate limit (300 / dəq., [RBAC.md](../docs/RBAC.md)). Cavablar CDN üçün keşlənir (`CachePolicy.CATALOG`, ETag).
- **Sinonimlər:** `search_synonyms (term, synonym)`, iki istiqamətdə işləyir, hər tərəf bir sözdür. V11 kiçik az/ru/tr dəsti əlavə edir; admin idarəsi #40-dadır.

## Satıcı API (#39, #128)

Hamısı `/api/v1/merchant` altında, rol `MERCHANT`, sahiblik hər sorğuda yoxlanılır ([RBAC.md](../docs/RBAC.md)).
Xətalar 3 dildə ProblemDetail-dir (`code: merchant.*`, sahə xətası `errors[].field` ilə).

| Endpoint | Təsvir |
| --- | --- |
| `POST /stores` | Mağaza müraciəti (hesaba bir mağaza): `PENDING`, satıcı yoxlaması `PENDING`. 201; eyni `Idempotency-Key` ilə təkrar 200 (həmin mağaza); başqa halda 409 `merchant.store_exists` |
| `GET /store`, `PUT /store` | Profil. `legalType`, `taxId` və slug burada dəyişmir (sənəd yoxlaması onlara bağlıdır, #40). Mağaza yoxdursa 404 `merchant.no_store` |
| `GET /dashboard` | Status üzrə məhsul sayı, son 30 günün WhatsApp klikləri. `views` hələ `null`-dur: baxış sayılmır, uydurma rəqəm verilmir |
| `GET /products`, `POST /products` | Silinməmiş məhsullar; yeni məhsul `DRAFT` (variantlar, daşlar ilə). `Idempotency-Key` təkrarı 200 |
| `GET/PUT/DELETE /products/{id}` | Redaktə formu (id-li variant dəyişir, id-siz əlavə olunur, olmayan silinir); `DELETE` = `INACTIVE` + `deleted_at`, sonra hər yerdə 404 |
| `PATCH /products/{id}/status` | `DRAFT`/`RETURNED`/`INACTIVE` -> `IN_REVIEW` (şəkil, variant, `APPROVED` mağaza və `VERIFIED` satıcı lazımdır); `IN_REVIEW` -> `DRAFT`; `APPROVED` -> `INACTIVE` (gizlət); satıcının gizlətdiyi `INACTIVE` -> `APPROVED`. Başqası 409 `merchant.status_transition` |
| `POST /products/bulk-status` | `{ids (ən çox 100), status}`: yuxarıdakı status dəyişikliyi hər məhsul üçün ayrıca tranzaksiyada (#109, məs. seçilmiş qaralamaları yoxlamaya göndər). Cavab hər id üçün `ok`, yeni `status` və ya `code` + yerli dildə `message`; başqa satıcının məhsulu `auth.forbidden`, digərlərini dayandırmır |
| `GET /products/import/template?lang=az\|en\|ru` | Boş CSV şablonu (UTF-8 BOM, `;`), sütun adları seçilən dildə |
| `POST /products/import` | CSV (`text/csv`, ən çox 1 MB və 200 sətir; ayırıcı `,` `;` və ya TAB, Excel və Google Sheets saxlayır). Başlıq sütunları açar (`category`, `name_az`, `price` ...) və ya üç dilin istənilənində ad ilə (`Qiymət (AZN)`, `Цена (AZN)`); `category`, `name_az`, `price` məcburidir. Hər sətir bir variantlı **DRAFT** məhsuldur, adi yaratma kimi yoxlanılır (eyni qaydalar, sahiblik, audit) və öz tranzaksiyasındadır: səhv sətir digərlərini dayandırmır, cavabda `errors[]` (`line`, `column`, `code`, `message` istifadəçinin dilində). Pul və çəki `BigDecimal`: `4,20` = `4.20`, `1 250,50` olar, `1,250.50` qeyri-müəyyəndir (xəta). Qiymət `FIXED` (metala bağlı qayda redaktorda). Bijuteriya sətirləri üçün `?notPreciousConfirmed=true` (satıcının təsdiqi). `Idempotency-Key` hər sətrə öz açarını verir: təkrar yükləmə heç nəyi iki dəfə yaratmır. Limit: `product-import-account` gündə 20 fayl. XLSX yox: Excel-də "CSV kimi saxla" |
| `POST /products/{id}/variants`, `PUT/DELETE .../variants/{variantId}` | Variant (ən çox 10). Siyahıdakı məhsulun son variantı silinmir |
| `POST /products/{id}/images/uploads` | Private bucket-ə presigned PUT (10 dəq.), JPEG/PNG/WebP, ən çox 15 MB. Açar `products/<store>/<product>/<uuid>.<ext>`. Limitlər (#154): qoşulmuş şəkillər + açıq (verilmiş, qoşulmamış, vaxtı keçməmiş) yükləmələr məhsulda 8-ə çatanda 409 `merchant.image_limit`; satıcı hesabı üzrə `image-upload-account` rate limit (60 / saat); mağaza üzrə 24 saatda 300 presign (`jeparla.merchant.images.daily-uploads-per-store`). Hər ikisi 429 + `Retry-After` |
| `POST /products/{id}/images` | Yüklənmiş faylı qoşur: bu məhsul üçün verilmiş açıq yükləmədir (URL-in vaxtı keçəndən sonra ən çox 30 dəq.), obyekt var, ölçü limitdədir, ilk baytları (magic number) açarın tipi ilə eynidir, tərəfi <= 12000 px; uyğun deyilsə fayl silinir. Yalnız bundan sonra fayl public bucket-ə köçürülür. `aiGenerated` işarəsi saxlanılır. Eyni açar təkrar 200 |
| `PUT /products/{id}/images/order`, `DELETE /products/{id}/images/{imageId}` | Sıra (birinci üz qabığıdır); silinən şəklin faylı commit-dən sonra silinir |
| `POST /drafts/uploads` | Qaralama üçün presigned PUT (#129, #109): `kind` `PHOTO` (çoxlu şəkil), `CAMERA` (telefon kamerası, `<input capture>`) və ya `PDF` (kataloq, ən çox 20 MB). Açar `drafts/<store>/<uuid>.<ext>`, staging private-dir. Rate limit: şəkil `image-upload-account`, PDF `catalog-pdf-account` (5 / saat); mağaza üzrə 24 saatda ən çox 300 qaralama (429) |
| `POST /drafts` | Yüklənmiş şəkil qaralama olur: məhsul şəkli kimi yoxlanılır (ölçü, magic bytes, tərəf <= 12000 px) və **private** bucket-də qalır, public-ə heç vaxt getmir. Başqa mağazanın açarı 400 `merchant.image_key` |
| `POST /drafts/pdf` | Kataloq PDF-i bir dəfə oxunur və silinir. Apache PDFBox yalnız gömülü şəkilləri və səhifə mətnini oxuyur (JavaScript, forma, əməliyyat icra olunmur); ən çox 30 səhifə (400 `merchant.pdf_pages`), şifrəli PDF yox, 200 px-dən kiçik şəkillər (loqo, ikon) və təkrarlanan eyni şəkil atlanır, elan olunmuş ölçüsü 40 MP-dən böyük şəkil dekod olunmur, ən çox 60 şəkil. Şəkli olmayan səhifə 110 DPI ilə render olunur. Hər şəkil ən çox 2000 px JPEG kimi private bucket-də qaralama olur; səhifədə bir şəkil varsa, səhifə mətnindən ad, qiymət (`1 250,50 AZN`, `990 ₼`) və çəki (`4,2 q`, `3.25 gr`) **təklif** kimi yazılır (`NUMERIC`), heç nə avtomatik dərc olunmur. Pullu və ya AI xidməti yoxdur |
| `GET /drafts`, `DELETE /drafts/{id}` | Mağazanın qaralamaları (yenilər əvvəl, şəkil üçün 15 dəqiqəlik private link) və silmə (şəkil də silinir). Başqa mağazanın qaralaması 403. Satıcı qaralamadan adi forma ilə məhsul yaradır: şəkli linkdən götürüb məhsul şəkli kimi yükləyir, sonra qaralamanı silir (private bucket CORS-u brauzerdən `GET`-ə də icazə verməlidir, aşağıdakı CORS qeydi) |

- **Moderasiya:** satılanı dəyişən redaktə (ad, təsvir, kateqoriya, metal, material, daşlar, əyar, çəki, yeni variant və ya şəkil) `APPROVED` məhsulu yenidən `IN_REVIEW`-ə (satıcı artıq yoxlanılmayıbsa `DRAFT`-a), gizlədilmiş və ya deaktiv məhsulu `DRAFT`-a qaytarır. Qiymət, stok, ölçü, SKU statusu dəyişmir.
- **Qiymət:** `METAL_LINKED` variant dərhal `PricingEngine` ilə son `APPLIED` kotirovkadan hesablanır (gündəlik job-la eyni hesab); kotirovka yoxdursa 409 `merchant.no_metal_price`. Hər qiymət `price_history`-yə `MERCHANT` səbəbi ilə yazılır. Pul və çəki `@Digits` ilə (qiymət 2, çəki 3 onluq), `BigDecimal`.
- **SKU:** mağaza daxilində unikal (409 `merchant.sku_taken`); verilməyəndə `JP<id>-xxxxxx` yaradılır.
- **Bijuteriya (#128, V13):** mağazanın `sellerKind`-i `PRECIOUS`, `FASHION` və ya `MIXED`; məhsulun `materialKind`-i `PRECIOUS` və ya `FASHION` (yaradılandan sonra dəyişmir). `FASHION` məhsulda metal, əyar, çəki və metal qiyməti yoxdur, yalnız `FIXED` qiymət, `material` (`BEADS`, `STAINLESS_STEEL`, `SILVER_PLATED` ...) və satıcının "qiymətli metal deyil" təsdiqi məcburidir; ad və təsvirdə qızıl/gümüş/brilyant/əyar iddiası (az, tr, en, ru və translit: `S925`, `AU750`, `925proba`, `14 karat`, `18 əyar`, `sterling`, `altın`, `zoloto` də; örtük və rəng sözü ilə, məs. `qızıl suyu`, `gold plated`, `позолота`, olmadan) 400 `merchant.fashion_claim`, xəta mətni iddia sayılan ifadəni satıcının yazdığı kimi göstərir (#157, məs. «585-ci əyar»). İcazəlidir (#157): rəng adları (`qızılı`, `gümüşü`, `rose gold`, `golden`, `золотистый`), `qızılgül`, `qızıl balıq`, `Qızılbaş`, ölçü və model rəqəmləri (`500 mm`, `750 ml`, `Model 800`). Ayrıca yazılan əyar rəqəmi (333 ... 999) metal sözü, əyar/proba sözü, metal kodu (`Au 585`) və ya zərgərlik sözü (`Üzük 585`, `585 sırğa`, `кольцо 585`) yanında iddiadır; ardınca ölçü vahidi (`mm`, `sm`, `ml`, `q`, `ədəd`, `шт` ...) gələndə və ya qabağında ölçü/uzunluq/model etiketi (`ölçü`, `uzunluq`, `model`, `размер`, `длина`, `art.`, `kod`) olanda iddia deyil; ardınca valyuta (`manat`, `AZN`, `₼`, `$`, `руб`, `рублей` ...) gələn rəqəm qiymətdir, iddia deyil (#162: `Sırğa 900 manat`, `Кольцо 750 рублей`). `999.9` iddiadır; karat `ct` ilə də (`18ct`, `18 ct`), amma örtük təsvirində (`18ct gold plated`) və daş çəkisində (`0.5 ct zirkon`) yox. `Diamond cut` (zəncir və sirkon kəsimi, bijuteriya termini) yalnız ardınca sirkon (`zirkon`, `CZ`, `фианит`) və ya zəncir sözü gələndə icazəlidir (`Diamond cut zirkon`, `Diamond-cut zəncir`), qalan halda iddiadır (qərar, #162). Xəta mətnindəki ifadədə mötərizə balanslıdır (`Üzük (585)`). `Almaz`, `Elmas` (ad, kolleksiya), ingiliscə `brilliant` və türkcə `altın` (azərbaycanca "alt hissə") yalnız material kontekstində iddiadır: ardınca zərgərlik və ya daş sözü (`Elmas küpe`, `altın yüzük`, `almaz daşlı`) və ya 3 söz yaxınlığında karat/proba sözü; şəkilçili formaları (`almazlı`, `altınlı`, `алмазом`) həmişə. Qaydalar `FashionClaims`-da, nümunələr `MerchantHelpersTests`-də; daş yalnız sertifikatsız sirkon. Baza da yoxlayır: `FASHION` məhsulun ekspertizası və `FASHION` mağazanın sənəd statusu `NONE`-dan başqa ola bilməz (heç vaxt "sənədlər yoxlanılıb" nişanı yoxdur). `FASHION` məhsullar frontend bölməsi hazır olana qədər ictimai kataloqda, axtarışda və seçilmişlərdə görünmür.
- **Fayllar (#154):** API faylı ötürmür; brauzer birbaşa **private** bucket-ə, `staging/<açar>` altına PUT edir. Oradan heç kim oxuya bilmir. Attach zamanı API faylı yoxlayır və yalnız uğurlu olanda server tərəfində (`CopyObject`) public bucket-ə `<açar>` altına köçürür, staging nüsxəsini silir. Qoşulmamış fayl heç vaxt public olmur.
  - **Yoxlanılan fayl = köçürülən fayl (#158):** presigned URL 10 dəqiqə etibarlıdır, satıcı attach zamanı eyni açara başqa bayt PUT edə bilər. Ona görə HEAD-in ETag-i yadda saxlanılır: ilk baytların oxunması (`GetObject` `If-Match`) və köçürmə (`CopyObject` `x-amz-copy-source-if-match`) həmin ETag ilə şərtlidir, köçürmədən dərhal əvvəl isə ikinci HEAD ETag və ölçünü müqayisə edir (şərti nəzərə almayan storage üçün də). Uyğunsuzluqda 400 `merchant.image_missing`, staged fayl silinir, public-ə heç nə düşmür. Storage şərtli `CopyObject`-ə 501 qaytarsa, köçürmə şərtsiz edilir (yalnız HEAD qoruyur, logda bir dəfə xəbərdarlıq). R2 və MinIO şərti dəstəkləyir; deploy zamanı yoxlayın (#45).
  - **Rollback:** public nüsxəni silən tranzaksiya sinxronizasiyası köçürmədən **əvvəl** qeydiyyatdan keçir: serverdə tamamlanıb müştəri tərəfdə uğursuz olan köçürmə (məs. timeout) attach-ı geri qaytarır və public açarı silir; slot açıq qalır, satıcı təkrar cəhd edə bilər.
  - **Attach-dan sonra təkrar PUT (qərar: qəbul):** URL vaxtı bitənə qədər bağlanmış slotun staged açarına yenidən PUT etmək olar. Bu fayl yalnız private bucket-dədir, heç vaxt public olmur (açar artıq qoşulub, yenidən köçürülmür) və lifecycle qaydası ilə 1 gün ərzində silinir.
  - **CORS:** frontend origin-i üçün `PUT` (və qaralama şəkilləri üçün `GET`, #129) CORS qaydası indi **private** bucket-də lazımdır (R2-də CORS bucket üzrədir; `.env.example`). Public bucket-ə brauzer yazmır.
  - **Təmizləmə:** hər presign `image_upload_slots` cədvəlində sətirdir (V14). `ImageUploadCleanupJob` (ShedLock kilidi `image-upload-cleanup`, `JEPARLA_UPLOAD_CLEANUP_CRON`) URL-in vaxtı 1 saatdan çox əvvəl keçmiş, qoşulmamış yükləmələrin staging faylını silir və 2 gündən köhnə sətirləri təmizləyir. Storage əlçatan deyilsə növbəti işə qədər gözləyir.
  - **Lifecycle qaydası (ehtiyat):** private bucket-də `staging/` prefiksi üçün 1 gündən köhnə obyektləri silən qayda olmalıdır. R2: Dashboard -> R2 -> `jeparla-private` -> Settings -> Object lifecycle rules -> prefix `staging/`, "Delete objects" 1 gün (və ya `wrangler r2 bucket lifecycle add`). Sənədlər (`staging/`-dən kənarda) bu qaydaya düşmür. Lokal MinIO-da `minio-init` eyni qaydanı `mc ilm import` ilə qoyur.
  - **Açarlar:** R2 API tokeni hər iki bucket-ə `Object Read & Write` icazəsi ilə; yalnız env-də.

## Paylaşım linki və mağaza faktları (#100, #108)

Satıcı kataloqunu bir linklə Instagram bio-da, TikTok-da, WhatsApp statusunda və Tap.az elanında paylaşır:
`JEPARLA_PUBLIC_SITE_URL/s/<kod>` (`jeparla.support.site-url`, e-poçt linkləri ilə eyni dəyər; default `http://localhost:3000`; prod-da `https://jeparla.az`, http(s) origin,
path yoxdur, səhv dəyər tətbiqi başlatmır).

| Endpoint | Kim | Nə edir |
| --- | --- | --- |
| `GET /api/v1/merchant/store/share` | `MERCHANT` | `ShareLink`: `code`, `url`, `qrUrl` (`url?ref=qr`), `active` (mağaza `APPROVED`-dirsə) |
| `GET /api/v1/merchant/store/share/qr.svg` | `MERCHANT` | `qrUrl`-in QR kodu, `image/svg+xml` (tünd yaşıl ağ fonda, 4 modul boşluq, `no-store`) |
| `POST /api/v1/merchant/store/share/regenerate` | `MERCHANT` | Yeni kod; köhnə link və çap olunmuş QR dərhal 404 olur. Audit `STORE_SHARE_LINK_REPLACED` (köhnə və yeni kod). `BLOCKED` mağaza 403 `merchant.store_blocked`; `share-regenerate-account` 5 / gün |
| `GET /api/v1/merchant/referrals?days=30\|90` | `MERCHANT` | `ReferralStats`: cəmi baxış və WhatsApp kliki, mənbə üzrə (çoxdan aza), gün üzrə (sıfırlar daxil). Başqa pəncərə 400 `merchant.referral_days` |
| `GET /api/v1/share/{code}` | hamı | `StorePreview` (`slug` daxil): frontend-in `/s/{code}` səhifəsi `/{locale}/stores/{slug}`-a yönləndirir. Naməlum, dəyişdirilmiş kod və ya ictimai olmayan mağaza 404. Heç nə saymır |
| `GET /api/v1/stores/{slug}/preview` | hamı | `StorePreview`: OG və paylaşım şəkli üçün ad, şəhər, `verified` (satıcı yoxlaması), `verification`, `productCount`, `coverImageUrl`, `logoUrl`. Kod burada yoxdur |
| `GET /api/v1/stores/{slug}/facts` | hamı | `StoreFacts` (#108), aşağıda |
| `POST /api/v1/stores/{slug}/visits?ref=` (və ya `utm_source=`) | hamı | Paylaşılmış linklə gələn baxışı sayır; ictimai mağaza üçün həmişə 204, başqası 404 |
| `POST /api/v1/products/{id}/contact-click?ref=` | hamı | Əvvəlki kimi məhsulun klikini sayır; `ref` (və ya `utm_source`) varsa klik mağazanın həmin mənbəsinə də yazılır |

- **Kod:** 8 simvol, `abcdefghijkmnpqrstuvwxyz23456789` (0/o, 1/l yoxdur), 32^8 ~ 10^12: sayaraq tapılmır. Slug-dan asılı
  deyil (`stores.share_code`, unikal, V20). API ilə yaranan mağazaya `ShareCodes.random()` (`SecureRandom`), SQL ilə
  yarananlara (demo seed) default `jeparla_new_share_code()` (`gen_random_uuid()` baytları) verir. Kodu yalnız sahibi
  dəyişir; ictimai `/stores/{slug}/preview` kodu göstərmir.
- **QR:** serverdə SVG (`io.nayuki:qrcodegen`, MIT, 38 KB, asılılıqsız): frontend QR kitabxanası yükləmir (250 KB
  skript büdcəsi). PNG lazımdırsa brauzer SVG-ni canvas-a çəkir.
- **Mənbə:** `ref` `utm_source`-dan üstündür, böyük-kiçik hərf və `_`/`-`-dən sonrakı hissə nəzərə alınmır:
  `INSTAGRAM` (`instagram`, `ig`, `insta`), `TIKTOK` (`tt`), `WHATSAPP` (`wa`), `TAPAZ` (`tap.az`), `FACEBOOK` (`fb`),
  `TELEGRAM` (`tg`), `YOUTUBE` (`yt`), `QR`, `LINK` (`link`, `share`), qalan hər şey `OTHER`. Mənbəsiz sorğu sayılmır.
- **Nə sayılmır:** bot və link önizləməsi (`BotUserAgents`: axtarış və AI crawler-ləri, `WhatsApp/`, `facebookexternalhit`,
  `TelegramBot`, `Twitterbot`, HTTP kitabxanaları, headless brauzer, Lighthouse; boş `User-Agent` də), `Sec-Purpose`/`Purpose:
  prefetch`, `referral-ip` limitindən (30 / saat, bütün mağazalar) artığı və eyni ünvan + mağaza + mənbədən
  `referral-visit` pəncərəsində (30 dəq.) təkrar baxış (yeniləmə). Sayılmayan sorğu da 204 alır.
- **Şəxsi məlumat yoxdur:** `store_referral_counts (store_id, day, source, visits, whatsapp_clicks)`, gün Asia/Baku.
  IP, user agent, istifadəçi id-si, baxış sətri saxlanılmır; limit açarları Redis-də SHA-256 ilə və vaxtı bitəndə silinir.
- **Statistikanın başlanğıcı:** `from` pəncərənin ilk günü və ya mağazanın yarandığı gündür (hansı gecdirsə). Sayğac bu
  buraxılışla (V20) başlayır: ondan əvvəlki günlərin sıfırı "ölçülməyib" deməkdir.

**Mağaza faktları (#108, `StoreFactsService`).** Hər sorğuda bazadan hesablanır (mağaza başına bir neçə indeksli sorğu,
CDN 5 dəq. saxlayır); heç bir rəqəm əl ilə yazılmır, gecəlik cədvəl yoxdur ki, fakt məlumatdan geri qalmasın. "Aktiv
məhsul" kataloqdakı kimidir: `APPROVED`, silinməyib, `PRECIOUS`, görünən kateqoriyada, canlı variantı var.

| Sahə | Necə hesablanır | Bilinməyəndə |
| --- | --- | --- |
| `onJeparlaSince`, `monthsOnJeparla` | adminin mağazanı ilk təsdiq etdiyi an (`stores.approved_at`); bu günə qədər tam təqvim ayı (Asia/Baku) | `null` |
| `activeProducts` | aktiv məhsul sayı (mağaza səhifəsinin `productCount`-u ilə eyni) | həmişə var, `0` realdır |
| `catalogUpdatedAt` | aktiv məhsulların ən son dəyişmə vaxtı (`products.updated_at`; gündəlik metal qiyməti yeniləməsi məhsula toxunmur) | aktiv məhsul yoxdursa `null` |
| `verifiedExpertise` | ekspertizası (`ASSAY_CERTIFICATE` və ya `LAB_REPORT`) admin tərəfindən təsdiqlənmiş aktiv məhsullar: `count` və `percent` (aşağı yuvarlaqlaşdırılır, heç vaxt şişirdilmir) | aktiv məhsul yoxdursa `percent: null` |
| `metalLinkedPrice` | ən az bir canlı `METAL_LINKED` variantı olan aktiv məhsullar (qiyməti AMB-nin gündəlik məzənnəsinə bağlıdır) | eyni |
| `hallmarkPhoto` | damğa şəkli olan məhsulların payı: şəkillər hələ "damğa şəkli" kimi işarələnmir | həmişə `null` |
| `documents` | `taxId`, `tradeLicense`: həmin növdən ən az bir sənədi admin təsdiqləyibsə `true` (#40, #164) | `FASHION` mağaza üçün `null` (sənəd yoxlaması yoxdur) |

Göstərilmir: reytinq və rəy (hələ yoxdur, #63) və WhatsApp cavab müddəti (söhbət Jeparla-dan kənardadır, ölçmək olmur).

## Yoxlama sənədləri, moderasiya və bildirişlər (#40, #138)

Sənəd yalnız qiymətli metal satan mağazadan (`PRECIOUS`, `MIXED`) və yalnız `PRECIOUS` məhsul üçün qəbul
olunur. Bijuteriya (`FASHION`) satıcısı və məhsulu heç vaxt sənəd yükləmir (`403 verification.not_precious`),
onların `documents`/`expertise` statusu `NONE` qalır; satıcı yoxlaması admin qərarıdır (`seller-check`).

| Endpoint | Nə edir |
| --- | --- |
| `GET /api/v1/merchant/documents` | Mağazanın sənədləri və yoxlama nəticəsi (açar və URL yoxdur) |
| `GET /api/v1/merchant/documents/declaration` | Təsdiqlənəcək bəyanat: `version`, `language`, `text`, `draft` |
| `POST /api/v1/merchant/documents/uploads` | Bir sənəd üçün presigned PUT (`checkKind` `DOCUMENTS`: `TAX_ID`, `TRADE_LICENSE`; `EXPERTISE`: `ASSAY_CERTIFICATE`, `LAB_REPORT` + `productId`). PDF, JPEG, PNG, ən çox 10 MB |
| `POST /api/v1/merchant/documents` | `{key, declarationAccepted: true, declarationVersion, declarationLanguage?}`: faylı yoxlayır, `201` `PENDING` sənəd |
| `GET /api/v1/admin/documents?status=` | Yoxlama növbəsi (default `PENDING`, köhnələr əvvəl) |
| `GET /api/v1/admin/documents/{id}` | Detal: SHA-256 və satıcının təsdiqlədiyi bəyanat |
| `POST /api/v1/admin/documents/{id}/view` | 5 dəqiqəlik presigned GET (`attachment`), `DOCUMENT_VIEWED` auditi |
| `POST /api/v1/admin/documents/{id}/decision` | `APPROVE`, `REJECT`, `REQUEST_CHANGES`; imtinada `reason` (`UNREADABLE`, `EXPIRED`, `MISMATCH`, `WRONG_TYPE`, `HALLMARK_MISSING`, `AUTHENTICITY`) və istəyə görə `note` |
| `GET /api/v1/admin/store-suspensions?status=` | Saxtalıq şübhəsi üzrə dayandırma sorğuları (#138, default `PENDING`, köhnələr əvvəl). `AUTHENTICITY` səbəbli rədd sorğunu avtomatik açır (`STORE_SUSPENSION_REQUESTED` auditi), mağaza hələ dayandırılmır |
| `POST /api/v1/admin/store-suspensions/{id}/decision` | `CONFIRM` (mağaza `BLOCKED`, bütün məhsulları gizlənir, satıcıya `store_suspended` bildirişi: hüquqi mətnin 2d bəndi, ittihamsız, 3 dildə, email də) və ya `DISMISS`; `note` yalnız audit üçündür. Sorğunu açan admin qərar verə bilməz (`409 verification.four_eyes`, baza CHECK-i da), qərar verilmiş sorğu `409 verification.suspension_decided` (V22) |
| `GET /api/v1/admin/stores?status=`, `GET /api/v1/admin/stores/{id}` | Mağaza müraciətləri (default `PENDING`) |
| `POST /api/v1/admin/stores/{id}/status` | `APPROVED`, `REJECTED`, `BLOCKED` (son ikisi ən az 10 simvol səbəblə) |
| `POST /api/v1/admin/stores/{id}/seller-check` | Satıcı yoxlaması: `VERIFIED` və ya `REJECTED` (səbəblə) |
| `GET /api/v1/admin/products?status=` | Yoxlamada olan məhsullar (default `IN_REVIEW`) |
| `POST /api/v1/admin/products/{id}/decision` | `APPROVE` (mağaza `APPROVED`, `PRECIOUS` üçün satıcı bəyanatı lazımdır: `409 admin.declaration_missing`), `RETURN`, `DEACTIVATE` (səbəblə) |
| `GET /api/v1/admin/audit?targetType=&targetId=` | Audit jurnalı, yenilər əvvəl |
| `GET /api/v1/notifications`, `GET /notifications/unread-count`, `POST /notifications/{id}/read`, `POST /notifications/read-all` | Daxil olmuş istifadəçinin öz bildirişləri |

- **Bəyanat (#138):** hər yükləmə `docs/legal/sellers-liability.md` 2b-dəki mətnlə təsdiqlənir (hüquqşünas
  təsdiqləyənə qədər **qaralama**, #57; `DeclarationText.VERSION`). Mətn dəyişəndə versiya da dəyişir və köhnə
  versiya ilə göndəriş `409 verification.declaration_outdated` olur. `seller_declarations` cədvəli (V15)
  göstərilən mətni, versiyanı, dili, istifadəçini, vaxtı və IP-ni saxlayır. API-nin baza rolu onu yalnız oxuyur
  və əlavə edir; trigger sahib rolu üçün də dəyişməyi, silməyi və `TRUNCATE`-i rədd edir (yalnız hesab silinəndə
  `user_id` `NULL` olur; "Verilənlər bazası rolları", #165). IP və istifadəçi etiketinin saxlama müddəti və
  psevdonimləşdirmə planı: `docs/legal/sellers-liability.md` 3.6 (təklif, #57).
- **Fayl:** brauzer private bucket-ə `staging/documents/<store>/<uuid>.<ext>` altına PUT edir. Təsdiqdə API
  faylın ilk baytlarını (PDF, PNG, JPEG imzası), ölçüsünü və SHA-256-ını yoxlayır, eyni faylın təkrarını
  (`409 verification.document_duplicate`) rədd edir və onu **eyni private bucket-də** `documents/...` altına
  köçürür. Sənəd public bucket-ə heç vaxt düşmür; `staging/` lifecycle qaydası `documents/`-ə toxunmur.
  `DocumentUploadCleanupJob` (kilid `document-upload-cleanup`) qoşulmamış yükləmələri şəkillərdəki kimi təmizləyir.
- **Status:** yoxlama yalnız admin ən az bir sənədi təsdiqləyəndə `VERIFIED` olur; gözləyən sənəd varsa
  `PENDING`, hamısı rədd edilibsə `REJECTED`. İctimai API yalnız bu statusu göstərir.
- **Bildirişlər:** qərar (sənəd, məhsul, mağaza, satıcı yoxlaması) satıcıya onun dilində (`users.preferred_locale`)
  nəzakətli bildiriş yaradır: səbəb, nə etməli və dəstək. Məhsulun adı satıcının dilindədir (tərcüməsi yoxdursa
  Azərbaycanca). "Dəstəyə yazın" deyən bildirişlər `Dəstək: <JEPARLA_SUPPORT_EMAIL>, <JEPARLA_SUPPORT_URL>` sətri
  ilə bitir, ikisi də yoxdursa satıcının dilində kömək səhifəsi ilə: saytda `/az/help`, e-poçtda tam URL
  (`https://jeparla.az/az/help`, #167). Apellyasiya yolu hazır olana qədər
  "14 gün ərzində yenidən baxılma" vəd edilmir. Mətn hadisə anında yazılır (`notifications`).
  E-poçtu olan istifadəçi üçün eyni tranzaksiyada `email_outbox` sətri yaranır; `EmailOutboxJob`
  (kilid `email-outbox`) onu `EmailSender` ilə göndərir: `JEPARLA_SMTP_HOST` varsa `SmtpEmailSender`, yoxdursa
  `NoEmailSender` (heç nə göndərmir və məktubu "göndərildi" saymır). Aşağıda: "E-poçt göndərmə".
- **Maraq toqquşması:** admin öz mağazası haqqında qərar vermir (403).

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
| `POST /api/v1/auth/password/forgot` | `{email}`; hesab olsa da, olmasa da **həmişə** 202, boş cavab (#131) |
| `POST /api/v1/auth/password/reset` | `{token, password}`; 204, bütün sessiyalar bitir, refresh cookie silinir |
| `POST /api/v1/auth/email/verify` | `{token}`; 204 (giriş tələb olunmur: link başqa brauzerdə açıla bilər) |
| `POST /api/v1/auth/email/verification` | daxil olmuş istifadəçiyə təsdiq linkini yenidən göndərir, 202 |
| `POST /api/v1/admin/users/{id}/password-reset-link` | `ADMIN`: telefonla qeydiyyatdan keçmiş satıcı üçün bərpa linki `{url, expiresAt}` |

Uğurlu cavab: `{accessToken, tokenType: "Bearer", expiresIn, user: {id, name, email, phone, role, roles, locale, emailVerified}}`
və `Set-Cookie: jeparla_refresh=...; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict`.
Xətalarda ProblemDetail-də `code` sahəsi var (`auth.invalid_credentials`, `auth.email_taken`,
`auth.refresh_invalid`, `auth.forbidden`, `rate_limited` ...); 429-da `Retry-After`.

Lokal sınaq (Git Bash):

```bash
curl -i -X POST localhost:8080/api/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Aysel","email":"aysel@example.az","password":"parol123"}'
```

### Şifrə bərpası və e-poçt təsdiqi (#131)

Qaydalar və rate limit-lər: [docs/RBAC.md](../docs/RBAC.md#şifrə-bərpası-və-e-poçt-təsdiqi-131). Qısaca:

- Token 256 bit təsadüfi, bazada (`account_tokens`, V19) yalnız SHA-256 hash-i; bir dəfə işləyir. Təsdiq linki
  24 saat, bərpa linki 1 saat (`jeparla.auth.account-email.*`).
- Link: `JEPARLA_PUBLIC_SITE_URL/{az|en|ru}/verify-email#token=...` və `.../reset-password#token=...`. Token
  fragment-dədir (`#`): brauzer onu serverə və `Referer`-ə göndərmir; səhifə onu oxuyub API-yə `POST` edir.
- Məktub yalnız e-poçtla gedir (in-app bildiriş yaranmır), hesabın dilində. `email_outbox.expires_at` doludur:
  göndəriləndən sonra, ya da link vaxtı keçəndə məktubun mətni `[one-time link removed]` ilə əvəzlənir, növbədə
  işləyən link qalmır. Vaxtı keçmiş link göndərilmir.
- Lokal sınaq: provayder yoxdursa link növbədə qalır:
  `SELECT body FROM email_outbox ORDER BY id DESC LIMIT 1;` (bir saat ərzində).

### E-poçt göndərmə

Provayderdən asılı olmayan SMTP (`spring-boot-starter-mail`, `SmtpEmailSender`): istənilən pulsuz SMTP relay
işləyir, kod dəyişmir. Seçim sahibindir; pulsuz planın limitini və şərtlərini qoşmazdan əvvəl rəsmi səhifədən
yoxlayıb tarixlə buraya yazın (PLAN 3a). Tələblər: SMTP + STARTTLS (587), öz domenindən göndərmə (SPF, DKIM),
transaksional məktub üçün pulsuz gündəlik limit. Namizədlər: Brevo, Resend, Amazon SES (SMTP interfeysi ilə).
Açar yalnız `JEPARLA_SMTP_PASSWORD`-dadır.

Göndərmə alınmasa məktub 5, 20, 45, 80 dəqiqə sonra yenidən cəhd olunur, 5 cəhddən sonra `FAILED` qalır. Logda
yalnız məktubun id-si yazılır (ünvan və mətn yox).

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
  üstəlik Redis 7 konteyneri və qorunan test endpoint-ləri qoşur. Konteynerdə prod-dakı iki rol var
  (`src/test/resources/db/test-roles.sql`): Flyway sahib rolu ilə miqrasiya edir, tətbiq və testlərin
  `JdbcTemplate`-i iş rolu ilə qoşulur; iş rolunun edə bilmədiyi fixture-lar (cədvəli boşaltmaq, test trigger-i)
  `DatabaseSuperuser` ilə edilir. Test JWT açarı `src/test/resources/config/application.yml`-dədir. Docker olmayan maşında
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
