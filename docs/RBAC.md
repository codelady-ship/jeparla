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

| Yol | Kim |
| --- | --- |
| `GET /api/v1/**` (kataloq, axtarış, metal qiymətləri) | hamı, anonim |
| `POST /api/v1/auth/register`, `/register/merchant`, `/login`, `/refresh`, `/logout` | hamı (rate limit ilə) |
| `/api/v1/auth/**` (qalanı, məs. `GET /me`) | daxil olmuş istifadəçi |
| `/api/v1/merchant/**` | `MERCHANT` |
| `/api/v1/admin/**` | `ADMIN` |
| `/api/v1/**` üzrə digər yazma sorğuları (`POST`, `PUT`, `PATCH`, `DELETE`) | daxil olmuş istifadəçi |
| `/actuator/health`, `/actuator/health/**` | hamı |
| `/actuator/**` (qalanı) | heç kim |
| `/v3/api-docs`, `/swagger-ui/**` | hamı |

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
- **Logout:** `POST /logout` ailəni ləğv edir və cookie-ni silir; həmişə 204.
- **İmza açarı:** yalnız `JEPARLA_JWT_SECRET` mühit dəyişənindən, ən azı 32 bayt; yoxdursa və ya
  qısadırsa tətbiq başlamır.

## Şifrə

BCrypt (cost 10), `DelegatingPasswordEncoder` ilə (`{bcrypt}...`). Qayda frontend ilə eynidir:
8-128 simvol, ən azı bir hərf və bir rəqəm; üstəlik UTF-8-də ən çox 72 bayt (BCrypt həddi; Azərbaycan
və rus hərfi 2 baytdır), uzun şifrə kəsilmir, rədd edilir.

Girişdə naməlum e-poçt/telefon və yanlış şifrə **eyni** cavabı verir (`401`,
`code: auth.invalid_credentials`) və eyni BCrypt işini görür (naməlum hesab saxta hash ilə
müqayisə olunur), ona görə cavab vaxtı da hesabın varlığını göstərmir. Bloklanmış hesab yalnız
düzgün şifrədən sonra `403 auth.account_blocked` alır. Qeydiyyatda isə tutulmuş e-poçt `409`
verir (istifadəçi buna ehtiyac duyur); bunu yoxlamaq rate limit ilə məhdudlaşdırılıb.

SMS OTP v1-də yoxdur (#52): satıcının telefonu `phone_verified = false` qalır.

## Rate limit

Sabit pəncərə, sayğaclar Redis-də (bütün instansiyalar üçün ortaq). Redis əlçatan deyilsə API
işləməyə davam edir: sayğaclar 30 saniyəlik fasilələrlə yaddaşa keçir. Açarlar (IP, e-poçt,
telefon) SHA-256 ilə hash-lənir, Redis-də şəxsi məlumat yoxdur.

| Siyasət | Default | Nə sayılır | Açar |
| --- | --- | --- | --- |
| `login-ip` | 20 / 5 dəq. | hər login cəhdi | IP |
| `login-account-ip` | 5 / 15 dəq. | yalnız **uğursuz** login (yanlış şifrə, naməlum login) | hesab + IP |
| `login-account` | 50 / saat | yalnız **uğursuz** login, bütün IP-lərdən | e-poçt və ya telefon (yazılışından asılı olmayaraq) |
| `login-known-address` | 30 gün | uğurlu girişin IP-si (nişan, limit yoxdur) | hesab + IP |
| `register-ip` | 10 / saat | hər qeydiyyat | IP |
| `register-account` | 5 / saat | hər qeydiyyat | e-poçt və ya telefon |
| `refresh-ip` | 60 / 5 dəq. | hər refresh | IP (token 256 bitdir, təxmin etmək olmur) |
| `report-ip`, `report-account` | 10 / saat, 5 / saat | | şikayət endpoint-i üçün hazırdır (#37) |

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
  HTTPS-də `Strict-Transport-Security`, `Cache-Control: no-store`.

## Audit

`AuditService.record(...)` admin və satıcı əməliyyatlarını `audit_logs`-a yazır: kim (id, ad, rol),
nə, hansı obyekt, IP. IP yalnız IPv4/IPv6 literal kimi parse olunur (DNS sorğusu heç vaxt olmur);
başqa dəyər (məs. host adı) `null` yazılır. Çağıranın tranzaksiyasında işləyir (dəyişiklik geri qaytarılsa, qeyd də yazılmır).
Şifrə, token və sənəd məzmunu heç vaxt yazılmır. İstifadə edənlər: #39 (satıcı), #40 (admin).

## Loglar

Şifrələr, tokenlər və refresh cookie heç vaxt loglanmır (sorğu DTO-larının `toString`-i onları
gizlədir; testlə yoxlanılır). Refresh tokenin təkrar istifadəsi yalnız user id və ailə id-si ilə
`WARN` kimi yazılır.
