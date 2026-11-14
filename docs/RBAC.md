# Rollar, icazələr və giriş (RBAC)

Jeparla API-sinin kim nəyi edə bilər qaydaları. Hər qərar **backend-də** verilir: frontend-in
`middleware.ts`-i və sessiya cookie-si yalnız UX üçündür (menyu, yönləndirmə), icazənin sübutu deyil.
Kod: `backend/src/main/java/az/jeparla/auth/SecurityConfig.java`, `store/StoreAccess.java`,
`product/ProductAccess.java` (#34).

## Rollar

| Rol | Kim | Nə edir |
| --- | --- | --- |
| `USER` | alıcı | seçilmişlər, şikayət, öz profili |
| `MERCHANT` | mağaza sahibi | `/api/v1/merchant/**`: yalnız **öz** mağazası və məhsulları |
| `ADMIN` | Jeparla komandası | `/api/v1/admin/**`: moderasiya, mağaza statusu, kataloq, əyarlar, audit |

İerarxiya: `ADMIN` və `MERCHANT` `USER`-in bacardığını da bacarır. `ADMIN` `MERCHANT` **deyil**:
admin mağazanı satıcı kimi redaktə etmir, yalnız admin endpoint-ləri ilə (və audit log ilə) işləyir.

Qeydiyyat: `POST /api/v1/auth/register` hesabı `USER` yaradır, `POST /api/v1/auth/register/merchant`
(/sell sihirbazının hesab addımı) isə `MERCHANT`. `ADMIN` API ilə yaradılmır (bazada əl ilə, #40).

## URL qaydaları (birinci qat)

Qaydalar `SecurityConfig.RULES`-dadır, yuxarıdan aşağı ilk uyğun gələn qərar verir. **Default deny (#134):**
heç bir qaydaya uyğun gəlməyən sorğu rədd olunur (anonim 401, daxil olmuş 403), məlumat heç vaxt qaytarılmır.
Yeni endpoint öz qaydası olmadan işləmir; `SecurityRuleCoverageTests` bütün controller-ləri gəzir və qaydası
olmayan endpoint-i adı ilə göstərib düşür.

| Yol | Kim |
| --- | --- |
| `/actuator/health`, `/actuator/health/**` | hamı |
| `/actuator/**` (qalanı) | heç kim |
| `GET /v3/api-docs/**`, `/swagger-ui.html`, `/swagger-ui/**` | hamı, amma yalnız `JEPARLA_API_DOCS=true` olanda var; default (prod) söndürülüb, 404 |
| `POST /api/v1/auth/register`, `/register/merchant`, `/login`, `/refresh`, `/logout` | hamı (rate limit ilə) |
| `POST /api/v1/auth/password/forgot`, `/password/reset`, `/email/verify` | hamı (rate limit ilə, #131) |
| `/api/v1/auth/**` (qalanı, məs. `GET /me`, `POST /email/verification`) | daxil olmuş istifadəçi |
| `/api/v1/admin/**` | `ADMIN` |
| `/api/v1/merchant/**` | `MERCHANT` |
| `/api/v1/notifications`, `/api/v1/notifications/**` (`GET` də) | daxil olmuş istifadəçi, yalnız öz bildirişləri (#138) |
| `/api/v1/favorites`, `/api/v1/favorites/**` (`GET` də) | daxil olmuş istifadəçi (`USER`, ierarxiya ilə hamı), yalnız öz siyahısı (#41) |
| `GET` ictimai kataloq: `/api/v1/products/**`, `/variants`, `/stores/**`, `/categories/**`, `/finenesses`, `/search/**`, `/metal-prices/**` | hamı, anonim (açıq siyahı; siyahıda olmayan `GET` ictimai deyil) |
| `POST /api/v1/products/{id}/reports`, `/products/{id}/contact-click`, `/stores/{id}/reports` | hamı, qonaq da (rate limit ilə, #37, #40) |
| `POST /internal/jobs/metal-prices` | paylaşılan sirr ilə (controller yoxlayır, #44) |
| qalan hər şey | heç kim |

Servis metodları rolu `@PreAuthorize` ilə yenidən yoxlayır (ikinci qat), məsələn
`@PreAuthorize("hasRole('MERCHANT')")`.

## Sahiblik (üçüncü qat)

Satıcı yalnız öz mağazasının resursunu dəyişir. İstifadəçi id-si **yalnız** yoxlanılmış access
token-in `sub`-undan gəlir, sorğu gövdəsindən və ya URL-dən heç vaxt.

```java
@Transactional
public ProductDto update(long productId, UpdateProductRequest request) {
    Product product = productAccess.requireOwner(productId); // 403 / 404
    ...
}
```

| Hal | Cavab |
| --- | --- |
| resurs bu satıcınındır | davam edir |
| resurs başqa satıcınındır | `403`, `code: auth.forbidden` |
| resurs yoxdur | `404`, `code: not_found` |
| heç kim daxil olmayıb | `401`, `code: auth.unauthenticated` |

İctimai id-lər ardıcıldır və təsdiqlənmiş məhsullar onsuz da görünür, ona görə 403 ilə 404-ün fərqi
gizli məlumat açmır; issue #34-ün "ikinci istifadəçi" testi 403 gözləyir.

### Satıcı API (#39)

- Mağaza URL-də yoxdur: `/api/v1/merchant/store` həmişə token sahibinin mağazasıdır (`stores.owner_id`
  unikal, hesaba bir mağaza). Mağaza yoxdursa `404 merchant.no_store`.
- Məhsul, variant və şəkil endpoint-ləri `ProductAccess.requireOwner` ilə başlayır: başqasının məhsulu
  `403 auth.forbidden`, olmayan və ya silinmiş məhsul `404 not_found`. Variant və şəkil həmin məhsulun
  içində axtarılır (başqa məhsulun variant id-si 404). Şəkil açarı yalnız bu məhsulun prefiksi ilə
  (`products/<store>/<product>/`) qəbul olunur.
- `BLOCKED` mağaza yalnız oxuyur: hər dəyişiklik `403 merchant.store_blocked`.
- Məhsulu yoxlamaya yalnız `APPROVED` mağaza və `VERIFIED` satıcı göndərir (`409 merchant.seller_not_verified`);
  `APPROVED` statusunu satıcı yalnız özü gizlətdiyi məhsula qaytarır, təsdiq admindədir (#40).
- Testlər: `MerchantProductApiTests.anotherMerchantsProductIsForbiddenEverywhere` (11 endpoint),
  `MerchantStoreApiTests.onlyMerchantsReachTheMerchantApi`.

### Yoxlama sənədləri (#40, #138)

- `/api/v1/merchant/documents/**` (`MERCHANT`): sənədi yalnız qiymətli metal satan mağaza (`PRECIOUS`,
  `MIXED`) yükləyir. `FASHION` mağaza və `FASHION` məhsul üçün hər yükləmə `403 verification.not_precious`;
  onların `documents`/`expertise` statusu həmişə `NONE` qalır. Ekspertiza sənədinin məhsulu
  `ProductAccess.requireOwner` ilə yoxlanılır (başqasının məhsulu 403, olmayan 404). Yükləmə açarı
  (`documents/<store>/<uuid>.<ext>`) yalnız onu alan mağaza üçün təsdiqlənir (başqası `400 verification.document_missing`).
- Hər yükləmə bəyanatla təsdiqlənir: `declarationAccepted: true` olmadan `400 verification.declaration_required`,
  köhnə versiya `409 verification.declaration_outdated`. Göstərilən mətn, versiya, dil, istifadəçi, vaxt və IP
  `seller_declarations`-da sübut kimi saxlanılır; cədvəl append-only-dir: tətbiqin baza rolu yalnız `SELECT`
  və `INSERT` edə bilər, trigger isə sahib rolu üçün də dəyişməyi, silməyi və `TRUNCATE`-i rədd edir (aşağıda
  "Verilənlər bazası rolları", #165).
- Fayllar yalnız private bucket-dədir. Satıcı faylı API-dən geri oxumur (cavabda açar və URL yoxdur);
  ictimai API yalnız statusu (`verification.documents`, `verification.expertise`) göstərir.
- `/api/v1/admin/documents/**` (`ADMIN`): növbə, detal, `POST /{id}/view` (5 dəqiqəlik presigned GET,
  `DOCUMENT_VIEWED` auditi), `POST /{id}/decision` (`APPROVE`, `REJECT`, `REQUEST_CHANGES`; imtinada səbəb
  kateqoriyası məcburidir). Yalnız təsdiqlənmiş sənəd yoxlamanı `VERIFIED` edir.
- Maraq toqquşması: admin öz mağazasının sənədinə, statusuna və məhsuluna qərar vermir (403).
- `/api/v1/admin/stores`, `/admin/products`, `/admin/audit` (`ADMIN`): mağaza statusu (`REJECTED`/`BLOCKED`
  üçün ən az 10 simvol səbəb), satıcı yoxlaması, məhsul qərarı (`APPROVE`; `RETURN`/`DEACTIVATE` səbəblə).
  `PRECIOUS` məhsul satıcı bəyanatı təsdiqləməmiş dərc olunmur (`409 admin.declaration_missing`).
  `GET /admin/stores?sellerStatus=PENDING` satıcı yoxlaması növbəsidir (bütün mağaza statuslarında); siyahıda
  mağazanın məhsul sayı (silinməmiş, istənilən status) var. Məhsul kartında ən ucuz canlı variantın qiyməti, əyarı,
  çəkisi və ilk şəkil var; olmayan dəyər `null`-dur, heç vaxt saxta `0` deyil.

### Admin: kataloq, istifadəçilər, şikayətlər (#40)

Hamısı `ADMIN`, hər yazma `audit_logs`-a düşür.

- **Kataloq** (`/admin/categories`, `/admin/finenesses`, `/admin/synonyms`): CRUD. İstifadədə olan silinmir:
  alt kateqoriyası və ya məhsulu (silinmiş də) olan kateqoriya, hər hansı variantın (silinmiş də) istifadə etdiyi əyar
  `409` (`admin.category_in_use`, `admin.fineness_in_use`); onları deaktiv edin. İstifadədə olan əyarın metalı və
  dəyəri dəyişmir. Kateqoriya öz alt ağacına köçürülmür (`409 admin.category_cycle`). Sinonimin hər tərəfi bir sözdür
  (fold-dan sonra 2-40 simvol), cüt hər iki istiqamətdə bir dəfə olur. Sinonim və ya kateqoriya dəyişəndə axtarış
  keşi (#151, 60 san.) commit-dən sonra boşalır, ictimai cavablar CDN-də ən çox bir neçə dəqiqə qalır.
- **İstifadəçilər** (`/admin/users`): siyahı (rol, status filtri; e-poçt və ya telefon parçası ilə axtarış), rol
  (`POST /{id}/role`: `USER` və ya `MERCHANT`) və bloklama (`POST /{id}/status`, bloklamada ən az 10 simvol səbəb).
  Qaydalar: admin öz rolunu və statusunu dəyişmir (`409 admin.self`); ən az bir aktiv admin qalır
  (`409 admin.last_admin`, yoxlama `ADMIN` rol sətrinin kilidi ilə ardıcıl gedir); `ADMIN` rolu API ilə verilmir
  (`400 admin.role_not_assignable`); mağaza sahibi `MERCHANT` olaraq qalır (`409 admin.user_owns_store`). Bloklama
  hesabın bütün refresh token-lərini ləğv edir; mağazanı gizlətmir (onu ayrıca bloklayın).
- **Şikayətlər** (`/admin/reports`): məhsul və mağaza şikayətləri (`status`, `targetType`, `storeId` filtri).
  `POST /{id}/resolution`: `RESOLVED` və ya `DISMISSED`, ən az 10 simvol qeyd. `RESOLVED` satıcıya bildiriş göndərir
  (yalnız adminin qeydi; şikayətçinin kimliyi və mətni heç vaxt); `DISMISSED` heç kimə. Bağlı şikayət `409
  admin.report_closed`; admin öz mağazası haqqında şikayətə qərar vermir (403).

### Seçilmişlər (#41)

`/api/v1/favorites`: `GET` (yeni əvvəldə, yalnız kataloqda görünən məhsullar), `PUT /{productId}` (idempotent, yalnız
görünən məhsul, ən çox 500), `DELETE /{productId}` (idempotent), `POST /import` (qonaq siyahısının birləşdirilməsi,
100 id-yə qədər). İstifadəçi yalnız token-in `sub`-udur: başqasının siyahısı oxunmur, dəyişmir. Hər elementdə bugünkü
qiymət (`product.priceFrom`) və saxlananda olan qiymət (`savedPrice`, V17-dən əvvəl saxlananlarda `null`) var (#112).
- Bildirişlər (`/api/v1/notifications`): hər istifadəçi yalnız özününkünü görür; başqasının bildirişi 404.
- Testlər: `DocumentApiTests` (rollar, başqa satıcı, `FASHION` 403, bəyanat, private saxlama, imtina bildirişi).

## Tokenlər

- **Access token:** JWT, HS256, 15 dəqiqə. Claim-lər: `sub` (user id), `roles`, `iss=jeparla`,
  `aud=jeparla-api`, `iat`, `exp`, `jti`. E-poçt, telefon və ad tokendə yoxdur. Göndərilir:
  `Authorization: Bearer <token>`. Geri çağırıla bilmir, ona görə qısadır: bloklanmış hesab və ya
  rol dəyişikliyi ən gec növbəti refresh-də (≤ 15 dəq.) qüvvəyə minir; `GET /me` isə dərhal 401 verir.
- **Refresh token:** 256 bit təsadüfi, 30 gün. Yalnız `jeparla_refresh` cookie-sində:
  `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`. Bazada yalnız SHA-256 hash-i saxlanılır
  (`refresh_tokens`, V8).
- **Rotasiya:** hər `POST /refresh` köhnə tokeni "istifadə olunub" kimi işarələyir və eyni ailədə
  yenisini verir. Köhnə token yenidən gəlsə (oğurlanmış surət), bütün ailə ləğv olunur və
  istifadəçi yenidən daxil olmalıdır. Digər cihazlardakı sessiyalar (başqa ailələr) qalır.
- **Sessiyanın mütləq ömrü (#134):** ailə login-dən 90 gün sonra bitir (`jeparla.auth.refresh-family-ttl`,
  V18 `family_expires_at`). Rotasiya onu uzatmır: yeni token ailənin sonundan uzun yaşamır (cookie-nin
  `Max-Age`-i də), sonra refresh `401 auth.refresh_invalid` verir, ailə ləğv olunur, istifadəçi yenidən daxil olur.
  Müddəti bitmiş sətirləri gündəlik iş silir; istifadə olunmuş və ləğv edilmiş tokenlər o vaxta qədər qalır
  (təkrar istifadəni tanımaq üçün).
- **Logout:** `POST /logout` ailəni ləğv edir və cookie-ni silir; həmişə 204.
- **İmza açarı:** yalnız `JEPARLA_JWT_SECRET` mühit dəyişənindən, ən azı 32 bayt; yoxdursa və ya
  qısadırsa tətbiq başlamır.

## Şifrə

BCrypt (cost 10), `DelegatingPasswordEncoder` ilə (`{bcrypt}...`). Qayda frontend ilə eynidir:
8-128 simvol, ən azı bir hərf və bir rəqəm; üstəlik UTF-8-də ən çox 72 bayt (BCrypt həddi; Azərbaycan
və rus hərfi 2 baytdır), uzun şifrə kəsilmir, rədd edilir.

Girişdə naməlum e-poçt/telefon və yanlış şifrə **eyni** cavabı verir (`401`,
`code: auth.invalid_credentials`) və eyni BCrypt işini görür (naməlum hesab saxta hash ilə
müqayisə olunur; prefiksi olmayan hash-li demo hesablar da bir BCrypt müqayisəsindən sonra rədd edilir, #134),
ona görə cavab vaxtı da hesabın varlığını göstərmir. Bloklanmış hesab yalnız
düzgün şifrədən sonra `403 auth.account_blocked` alır. Qeydiyyatda isə tutulmuş e-poçt `409`
verir (istifadəçi buna ehtiyac duyur); bunu yoxlamaq rate limit ilə məhdudlaşdırılıb.

SMS OTP v1-də yoxdur (#52): satıcının telefonu `phone_verified = false` qalır.

## Şifrə bərpası və e-poçt təsdiqi (#131)

Kod: `auth/AccountRecoveryController`, `PasswordResetService`, `EmailVerificationService`, `AccountTokenService`.

**Token.** 256 bit təsadüfi (base64url), linkdə bir dəfə göndərilir; bazada (`account_tokens`, V19) yalnız SHA-256
hash-i, məqsədi (`EMAIL_VERIFICATION` və ya `PASSWORD_RESET`), göndərildiyi e-poçt və müddəti saxlanılır. Token
bir dəfə işləyir (sətir `FOR UPDATE` ilə kilidlənir, eyni anda iki sorğu onu iki dəfə işlədə bilmir), vaxtı keçəndə,
başqa məqsədin linki olanda və ya hesabın e-poçtu artıq başqa olanda eyni `400` verir. Biri uğurla işlənəndə həmin
hesabın eyni məqsədli digər açıq linkləri də bitir. Vaxtı keçmiş tokenlər saatlıq job ilə silinir.

**Link.** `JEPARLA_PUBLIC_SITE_URL/{dil}/verify-email#token=...` və `/{dil}/reset-password#token=...`, hesabın
dilində. Token URL fragment-indədir: brauzer onu nə serverə, nə `Referer`-ə göndərir. Məktub yalnız e-poçtladır
(in-app bildirişdə link saxlanılmır); növbədəki məktubun mətni göndəriləndən və ya link vaxtı keçəndən sonra
`[one-time link removed]` olur, vaxtı keçmiş link göndərilmir.

**E-poçt təsdiqi.** E-poçtla hər qeydiyyat (alıcı və e-poçt yazan satıcı) 24 saatlıq link alır; açılanda
`users.email_verified = true` və `EMAIL_VERIFIED` auditi. `GET /me` və login cavabında `user.emailVerified` var.
Təsdiqlənməmiş hesab **hər şeyi** edə bilir (giriş, seçilmişlər, şikayət, satıcı kabineti): satıcının girişi telefon,
məhsulun dərci isə adminin satıcı yoxlamasından (`VERIFIED`) asılıdır, e-poçtdan yox. Bayraq frontend-ə "e-poçtunuzu
təsdiqləyin" xatırlatması üçündür. Təsdiq linki ilə şifrə bərpası linki eyni ünvana gedir, ona görə e-poçtla
bərpa ünvanı da təsdiqləyir. Təsdiqlənməmiş ünvana bildiriş məktubları (#138) əvvəlki kimi gedir.

| Endpoint | Kim | Cavab |
| --- | --- | --- |
| `POST /api/v1/auth/email/verify` `{token}` | hamı | `204`; etibarsız/işlənmiş/vaxtı keçmiş link `400 auth.verification_token_invalid` |
| `POST /api/v1/auth/email/verification` | daxil olmuş | `202` yeni link; e-poçt yoxdur `409 auth.no_email`; artıq təsdiqlənib `409 auth.email_already_verified` |

**Şifrə bərpası.**

| Endpoint | Kim | Cavab |
| --- | --- | --- |
| `POST /api/v1/auth/password/forgot` `{email}` | hamı | **həmişə** `202`, boş gövdə, eyni başlıqlar |
| `POST /api/v1/auth/password/reset` `{token, password}` | hamı | `204` + refresh cookie silinir; etibarsız link `400 auth.reset_token_invalid` |

- Cavab hesabın varlığını açmır: naməlum e-poçt, bloklanmış hesab və hesab limitini keçmiş ünvan da eyni `202`-ni
  alır. Hesab olanda token, növbə və audit yazılır, olmayanda yox; bu fərqi cavab vaxtı göstərməsin deyə hər sorğu
  ən azı `forgot-response-floor` (400 ms) gözləyir. Yalnız IP limiti `429` verir: açar sorğu göndərəndir, ünvan yox.
- Yeni şifrə qeydiyyatın qaydalarındandır (8-128 simvol, hərf və rəqəm, ən çox 72 bayt). Uğurlu bərpa: yeni BCrypt
  hash, **bütün** refresh token ailələri ləğv olunur (`RefreshTokenService.revokeAllOf`: bütün cihazlar çıxır;
  access token ən gec 15 dəqiqədə bitir), digər bərpa linkləri bitir, link e-poçtla gəlibsə ünvan təsdiqlənir.
  Bloklanmış hesab bərpa ilə açılmır (`400`).
- Audit: `PASSWORD_RESET_REQUESTED` (yalnız mövcud hesab üçün), `PASSWORD_RESET` (`{"via":"email"|"admin_link"}`),
  `EMAIL_VERIFIED`; aktor hesabın özüdür (link kimin olduğunu sübut edir), IP ilə. Token və şifrə yazılmır.

**Telefonla qeydiyyatdan keçmiş satıcı (e-poçtsuz).** Ona e-poçt göndərilə bilmir, SMS isə sahibin qərarını
gözləyir (#52, pulludur, PLAN 3a), ona görə kod SMS göndərmir. #52 qərarına qədər yol admin vasitəsilədir:

1. Satıcı dəstəyə yazır. Admin onu hesabdakı telefon nömrəsi ilə yoxlayır (məs. həmin nömrəyə WhatsApp zəngi,
   mağaza adı və VÖEN kimi məlumatların soruşulması).
2. `POST /api/v1/admin/users/{id}/password-reset-link` (`ADMIN`) 1 saatlıq birdəfəlik link qaytarır
   `{url, expiresAt}`; bazada yalnız hash-i və verən admin (`issued_by`) qalır, audit `PASSWORD_RESET_LINK_ISSUED`.
3. Admin linki yalnız hesabdakı nömrəyə göndərir. Satıcı yeni şifrəni təyin edir, bütün sessiyalar bitir.

Admin hesabı, e-poçtu təsdiqlənmiş hesab (özü bərpa edir) və aktiv olmayan hesab üçün link verilmir
(`409 auth.reset_link_not_allowed`). E-poçtu olan, amma təsdiqlənməmiş satıcı həm özü bərpa edə bilər, həm admin linki alır.

## Rate limit

Sabit pəncərə, sayğaclar Redis-də (bütün instansiyalar üçün ortaq). Redis əlçatan deyilsə API
işləməyə davam edir: sayğaclar 30 saniyəlik fasilələrlə yaddaşa keçir. Açarlar (IP, e-poçt,
telefon) SHA-256 ilə hash-lənir, Redis-də şəxsi məlumat yoxdur.

Redis-də yalnız sayğaclar var, hər birinin TTL-i öz pəncərəsidir (#134). `maxmemory-policy noeviction`:
yaddaş dolanda Redis canlı sayğacı silmir (limit sıfırlanmazdı), yazmanı rədd edir və API yaddaşdakı
sayğaclara keçir (compose CI yoxlayır). Yaddaşdakı sayğaclar ən çox 50 000 açardır: dolanda əvvəl müddəti
bitmişlər, sonra ən tez bitənlər silinir, ona görə Redis düşəndə açar seli heap-i böyütmür. Axtarış keşi
Redis-də deyil (#151).

| Siyasət | Default | Nə sayılır | Açar |
| --- | --- | --- | --- |
| `login-ip` | 20 / 5 dəq. | hər login cəhdi | IP |
| `login-account-ip` | 5 / 15 dəq. | hər cəhd şifrə yoxlamasından **əvvəl** atomik sayılır (#134), uğurlu login sıfırlayır, ona görə faktiki olaraq yalnız **uğursuz** login-lər yığılır. Eyni ünvandan paralel sorğuların ən çoxu 5-i şifrə yoxlamasına çatır | hesab + IP |
| `login-account` | 50 / saat | yalnız **uğursuz** login, bütün IP-lərdən | e-poçt və ya telefon (yazılışından asılı olmayaraq) |
| `login-known-address` | 30 gün | uğurlu girişin IP-si (nişan, limit yoxdur) | hesab + IP |
| `register-ip` | 10 / saat | hər qeydiyyat | IP |
| `register-account` | 5 / saat | hər qeydiyyat | e-poçt və ya telefon |
| `refresh-ip` | 60 / 5 dəq. | hər refresh | IP (token 256 bitdir, təxmin etmək olmur) |
| `report-ip`, `report-account` | 10 / saat, 5 / saat | hər şikayət | IP, user id: `POST /products/{id}/reports` (#37) və `POST /stores/{id}/reports` (#40), sayğaclar ortaqdır; limit yoxlaması məhsulun (mağazanın) varlığından əvvəldir |
| `password-forgot-ip` | 10 / saat | hər "şifrəni unutdum" | IP: aşanda `429` (#131) |
| `password-forgot-account` | 3 / saat | hər "şifrəni unutdum", hesab olsa da, olmasa da | e-poçt: aşanda cavab yenə `202`, amma məktub yazılmır (başqasının poçtunu doldurmaq olmur) |
| `password-reset-ip` | 20 / saat | hər yeni şifrə cəhdi | IP |
| `email-verify-ip` | 30 / saat | hər təsdiq linki | IP |
| `email-verification-account` | 3 / saat | hər "linki yenidən göndər" | user id: aşanda `429` |
| `contact-ip` | 60 / saat | hər klik | IP: `POST /products/{id}/contact-click`; limitdən artıq klik xətasız (204) qəbul olunur, amma sayılmır |
| `search-ip` | 300 / dəq. | hər axtarış və təklif sorğusu | IP: `GET /search`, `GET /search/suggest` (#38); CDN-dən verilən cavab API-yə çatmır, sayılmır. Frontend serverdən (SSR, `/api/suggest`) çağıranda bütün ziyarətçilər serverin IP-si ilə sayılır: #41-də limit buna görə seçilməlidir |
| `image-upload-account` | 60 / saat | hər presign sorğusu | user id: `POST /merchant/products/{id}/images/uploads` (#154); limit yoxlaması sahiblikdən əvvəldir. Bundan əlavə mağaza üzrə 24 saatda 300 presign (429, `Retry-After` ən köhnə presign-in 24 saat tamam olmasına qədər) və məhsulda qoşulmuş şəkil + açıq yükləmə cəmi 8 (409 `merchant.image_limit`) |
| `document-upload-account` | 20 / saat | hər sənəd presign sorğusu | user id: `POST /merchant/documents/uploads` (#40). Bundan əlavə mağaza üzrə 10 açıq yükləmə (409 `verification.upload_limit`) və 24 saatda 50 presign (429) |

Limit aşılanda: `429`, `Retry-After` (saniyə), `code: rate_limited`, mətn 3 dildə. Dəyərlər
`jeparla.rate-limit.policies.<id>.limit|window` ilə dəyişir. IPv6 müştəri /64 şəbəkəsi ilə sayılır
(bir abunəçi bütün /64-ü dəyişə bilir).

### Login: hesabı kənardan bloklamaq olmur (#133)

Satıcının login-i açıq telefon nömrəsidir, ona görə hesab limiti yalnız **uğursuz şifrələri** sayır
(şifrə yoxlamasından sonra). Sorğu göndərmək hesabı bloklamır.

1. `login-ip`: bir IP-dən hər cəhd (çox hesabı yoxlamaq).
2. `login-account-ip`: bir hesaba bir IP-dən 5 yanlış şifrədən sonra həmin IP bu hesab üçün şifrə
   yoxlanılmadan `429` alır. Uğurlu giriş bu sayğacı sıfırlayır. Başqa IP-lər (sahibin IP-si) təsirlənmir.
3. `login-account`: hesaba bütün IP-lərdən 50 yanlış şifrə/saat: hesab "hücum altında"dır. Bu vaxt
   yalnız hesabın tanış ünvanlarından (son 30 gündə uğurlu giriş olmuş IP) giriş olur, yeni IP şifrə
   yoxlanılmadan `429` alır, ona görə paylanmış təxmin də dayanır. Sahib tanış ünvandan həmişə daxil olur;
   yeni ünvandan isə pəncərə bitənədək gözləyir (`Retry-After`).

Açarlar yalnız göndərilənə (login və IP) bağlıdır, hesabın olub-olmamasına yox; `429` şifrə
yoxlamasından əvvəl verilir. Mövcud və naməlum hesablar eyni cavabı eyni müddətdə alır. Bloklanmış
hesabın `403`-ü uğursuz cəhd sayılmır (yalnız düzgün şifrədən sonra gəlir).

### Müştəri IP-si (#132)

IP yalnız `ClientIpFilter`-dən gəlir (`az.jeparla.common.net`): `X-Forwarded-For` yalnız TCP
qarşı tərəfi `JEPARLA_TRUSTED_PROXIES`-dəki proxy (Caddy) olanda oxunur və sağdan ilk etibarsız
ünvan müştəridir. Standart `Forwarded` başlığına heç vaxt inanılmır (Caddy onu yazmır, müştərininkini
ötürür). Başqa hər kəs üçün IP TCP ünvanıdır, başlıqlar nəzərə alınmır. Spring-in
`ForwardedHeaderFilter`-i söndürülüb (`server.forward-headers-strategy: none`): o, hər göndərənə
inanırdı. Caddy konfiqurasiyası: [backend/README.md](../backend/README.md#reverse-proxy-və-müştəri-ip-si).

## CORS, CSRF və başlıqlar

- CORS yalnız `JEPARLA_FRONTEND_ORIGIN`-dəki dəqiq origin-lərə, `credentials` icazəli
  (refresh cookie üçün); başqa origin 403 alır.
- CSRF qoruması söndürülüb: API çağırışlarını heç bir cookie doğrulamır (Bearer token). Yeganə cookie
  refresh-dir: yalnız `/api/v1/auth`-a, yalnız eyni saytdan (`SameSite=Strict`) gedir.
- Başlıqlar: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (Swagger UI xaric),
  HTTPS-də `Strict-Transport-Security`, `Cache-Control: no-store` (istisna: ictimai kataloq GET cavabları `public`, `s-maxage`, `stale-while-revalidate` və ETag ilə CDN-də keşlənir, #37).

## Audit

`AuditService.record(...)` admin və satıcı əməliyyatlarını `audit_logs`-a yazır: kim (id, ad, rol),
nə, hansı obyekt, IP. IP yalnız IPv4/IPv6 literal kimi parse olunur (DNS sorğusu heç vaxt olmur);
başqa dəyər (məs. host adı) `null` yazılır. Çağıranın tranzaksiyasında işləyir (dəyişiklik geri qaytarılsa, qeyd də yazılmır).
Şifrə, token və sənəd məzmunu heç vaxt yazılmır. İstifadə edənlər: #39 (satıcı), #40 (admin).

Satıcı əməliyyatları (#39): `STORE_CREATED`, `STORE_UPDATED`, `PRODUCT_CREATED`, `PRODUCT_UPDATED`,
`PRODUCT_STATUS_CHANGED` (`{"from","to"}`), `PRODUCT_DELETED`, `VARIANT_ADDED`, `VARIANT_UPDATED`,
`VARIANT_REMOVED`, `IMAGE_ADDED` (`aiGenerated` ilə), `IMAGE_REMOVED`, `DECLARATION_CONFIRMED`,
`DOCUMENT_UPLOADED` (`sha256` ilə; #138).

Admin əməliyyatları (#40): `DOCUMENT_VIEWED`, `DOCUMENT_APPROVED`, `DOCUMENT_REJECTED`,
`DOCUMENT_CHANGES_REQUESTED` (səbəb kateqoriyası və qeyd), `STORE_APPROVED`, `STORE_REJECTED`, `STORE_BLOCKED`,
`SELLER_VERIFIED`, `SELLER_REJECTED`, `PRODUCT_APPROVED`, `PRODUCT_RETURNED`, `PRODUCT_DEACTIVATED` (səbəblə),
`CATEGORY_CREATED`, `CATEGORY_UPDATED`, `CATEGORY_DELETED`, `FINENESS_CREATED`, `FINENESS_UPDATED`,
`FINENESS_DELETED`, `SYNONYM_CREATED`, `SYNONYM_UPDATED`, `SYNONYM_DELETED` (`CATALOG`; `details`-də əvvəlki və yeni
dəyər), `USER_ROLE_CHANGED`, `USER_BLOCKED` (səbəblə), `USER_UNBLOCKED` (`USER`), `REPORT_RESOLVED`, `REPORT_DISMISSED`
(`REPORT`, qeyd `reason`-dadır).
`GET /api/v1/admin/audit` jurnalı göstərir (`targetType`, `targetId` filtri).

Hesab əməliyyatları (#131, hədəf `USER`): `EMAIL_VERIFIED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET`
(aktor hesabın özüdür, `AuditService.recordAs`), `PASSWORD_RESET_LINK_ISSUED` (aktor admin).

`audit_logs` append-only-dir (V16, #165): tətbiq yalnız oxuyur və əlavə edir; yeganə dəyişiklik hesab
silinəndə `actor_id`-nin `NULL` olmasıdır (`actor_label` qalır). Köhnə sətirlərin silinməsi yalnız sahib rolunun
çağıra bildiyi `jeparla_purge_audit_logs(interval)` funksiyası ilə, ən azı 5 ildən köhnə sətirlər üçün mümkündür
(müddət hüquqşünasın təsdiqini gözləyir, `docs/legal/sellers-liability.md` 3.6, #57); planlı job yoxdur.

## Verilənlər bazası rolları (#165)

Sübut cədvəllərinin (`seller_declarations`, `audit_logs`) dəyişməzliyi trigger-ə yox, baza rollarına söykənir:
cədvəlin sahibi trigger-i söndürə bilər, superuser isə `session_replication_role = replica` ilə bütün trigger-ləri.
Ona görə:

| Rol | Kim qoşulur | Nə edə bilər |
| --- | --- | --- |
| superuser (`postgres`) | yalnız baza konteynerinin özü və texniki xidmət | hər şey; parolu API-yə verilmir |
| miqrasiya rolu (`JEPARLA_DB_MIGRATION_USER`, `jeparla_owner`) | yalnız Flyway (`spring.flyway.user`) | sxemin və cədvəllərin sahibi; superuser deyil |
| iş rolu (`JEPARLA_DB_USER`, `jeparla_app`) | API (`spring.datasource.username`) | adi cədvəllərdə `SELECT`, `INSERT`, `UPDATE`, `DELETE`; sübut cədvəllərində yalnız `SELECT`, `INSERT`; `TRUNCATE`, `ALTER`, `DROP`, trigger, yeni obyekt yoxdur |

- Hesab silinəndə `ON DELETE SET NULL` sahib rolu adı ilə işləyir (PostgreSQL referential action), trigger-lər
  yalnız bu dəyişikliyə (`user_id`/`actor_id` -> `NULL`) icazə verir; iş rolu bu sütunu birbaşa dəyişə bilmir.
- `BEFORE TRUNCATE` trigger-ləri `TRUNCATE ... CASCADE` ilə gələn silinməni də sahib rolu üçün dayandırır.
- Sonrakı miqrasiyaların cədvəlləri default privileges ilə iş roluna avtomatik açılır. Yeni sübut cədvəli
  əlavə edən miqrasiya onun üçün `UPDATE`, `DELETE`-i `REVOKE` etməli və `DatabaseRoleCheck.EVIDENCE_TABLES`-ə
  əlavə etməlidir.
- `DatabaseRoleCheck` API başlayanda yoxlayır: iş rolu superuser, sahib və ya sübut cədvəllərində
  `UPDATE`/`DELETE`/`TRUNCATE`/`TRIGGER` hüquqlu olsa, API başlamır.
- Testlər: bütün Spring testləri iş rolu ilə işləyir (Flyway sahib rolu ilə); `EvidenceTablesTests` iş rolu ilə
  `UPDATE`, `DELETE`, `TRUNCATE` (`CASCADE` da), `ALTER TABLE ... DISABLE TRIGGER`, `DROP TRIGGER`,
  `SET session_replication_role` və retention funksiyasının rədd olunduğunu, hesab silinəndə isə yalnız
  istinadın `NULL` olduğunu yoxlayır. Compose CI eyni yoxlamanı işləyən stack-də edir.
- Qurulum və mövcud baza üçün keçid: [backend/README.md](../backend/README.md), "Verilənlər bazası rolları".

## Loglar

Şifrələr, tokenlər və refresh cookie heç vaxt loglanmır (sorğu DTO-larının `toString`-i onları
gizlədir; testlə yoxlanılır). Refresh tokenin təkrar istifadəsi yalnız user id və ailə id-si ilə
`WARN` kimi yazılır.
