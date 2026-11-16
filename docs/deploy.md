# Deploy: pulsuz planlarda canlı sayt (#45, #46, #47)

Bu sənəd sahib üçündür: hesabları özünüz açırsınız, kartı özünüz təsdiqləyirsiniz, bütün açarlar yalnız
VM-dəki `deploy/.env` faylında və parol menecerinizdə qalır. Heç bir açarı chat-a, issue-ya və ya repoya
yazmayın.

Domen hələ yoxdur. Bütün sistem bir pulsuz Oracle VM-də işləyir, ünvanlar pulsuz DuckDNS adındandır:

| Hissə | Harada | Ünvan (nümunə) |
|---|---|---|
| Sayt (Next.js) | Oracle VM, konteyner `web` | `https://jeparla.duckdns.org` |
| API (Spring Boot) | Oracle VM, konteyner `api` | `https://api.jeparla.duckdns.org` |
| Şəkillər və yükləmələr | Oracle VM, S3 uyğun xidmət `s3` (Silo) | `https://s3.jeparla.duckdns.org` |
| PostgreSQL 16, Redis 7 | Oracle VM, konteyner | yalnız daxili şəbəkə |
| HTTPS | Caddy, Let's Encrypt (avtomatik alır və yeniləyir) | |

Fayllar: `deploy/docker-compose.prod.yml`, `deploy/Caddyfile`, `deploy/.env.example`,
`deploy/scripts/` (`setup-vm.sh`, `gen-secrets.sh`, `deploy.sh`, `backup.sh`), `frontend/Dockerfile`,
`backend/Dockerfile`.

Saytın niyə Cloudflare-də deyil, VM-də olduğu: bölmə 9.

## 0. Limitlər (yoxlama tarixi: 2026-11-16)

| Xidmət | Pulsuz limit | Mənbə |
|---|---|---|
| Oracle A1 (Arm) | ayda 1500 OCPU saatı + 9000 GB saatı = **2 OCPU, 12 GB RAM** daimi; 200 GB disk (boot + block), yalnız home region; ayda 10 TB çıxış trafiki | [Oracle Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) |
| Oracle Object Storage | 20 GB, ayda 50 000 sorğu (backup üçün) | eyni səhifə |
| DuckDNS | 5 pulsuz ad, giriş GitHub/Google ilə | [duckdns.org](https://www.duckdns.org) |
| Let's Encrypt | `duckdns.org` Public Suffix List-dədir: limit hər ad üçün ayrıca sayılır | [LE rate limits](https://letsencrypt.org/docs/rate-limits/) |

Diqqət: köhnə qeydlərdə "4 OCPU / 24 GB" yazılıb; Oracle bu gün pulsuz hissəni **2 OCPU / 12 GB** kimi
göstərir. Compose faylı bu həddə görə qurulub (konteyner limitlərinin cəmi təxminən 5 GB).

## 1. Oracle Cloud hesabı (sahib edir)

1. <https://signup.cloud.oracle.com> -> ad, e-poçt, ölkə **Azerbaijan**.
2. **Home Region**: `Germany Central (Frankfurt)` (`eu-frankfurt-1`). Sonradan dəyişmir və Always Free
   resurslar yalnız home region-dadır. Frankfurt-da A1 tutumu bəzən bitir ("Out of capacity"); onda
   `Netherlands Northwest (Amsterdam)` və ya `UK South (London)` da uyğundur.
3. Kart doğrulaması: kartdan kiçik məbləğ bloklanır və qaytarılır. Bu addımı yalnız siz edirsiniz.
4. Hesab açılandan sonra (tövsiyə, bölmə 12): **Billing & Cost Management -> Upgrade and Manage Payment ->
   Pay As You Go**. Always Free limitində ödəniş yoxdur. Dərhal **Budgets -> Create Budget**: 1 USD, 100%
   olanda e-poçt xəbərdarlığı.

## 2. SSH açarı (sizin Windows kompüterinizdə)

PowerShell:

```powershell
ssh-keygen -t ed25519 -f $HOME\.ssh\jeparla_oracle -C "jeparla-vm"
Get-Content $HOME\.ssh\jeparla_oracle.pub
```

Passphrase soruşanda güclü parol yazın. `.pub` faylının mətni növbəti addımda lazımdır; `.pub`-suz fayl
(gizli açar) heç kimə göndərilmir.

## 3. A1 VM yaratmaq

Oracle Console -> menyu -> **Compute -> Instances -> Create instance**:

1. **Name**: `jeparla-prod`.
2. **Image and shape -> Edit**:
   - **Change image** -> **Canonical Ubuntu** -> `24.04` (aarch64 versiyası avtomatik seçilir).
   - **Change shape** -> **Virtual machine -> Ampere** -> `VM.Standard.A1.Flex` -> **OCPU: 2, Memory: 12 GB**.
     Yanında "Always Free-eligible" yazısı olmalıdır.
3. **Networking**: "Create new virtual cloud network" (standart), **Assign a public IPv4 address: Yes**.
4. **Add SSH keys** -> "Paste public keys" -> `jeparla_oracle.pub`-un mətni.
5. **Boot volume**: "Specify a custom boot volume size" -> **100 GB** (200 GB pulsuz limitin yarısı).
6. **Create**. Bir neçə dəqiqəyə status `RUNNING` olur. **Public IP address**-i qeyd edin (məs. `141.147.1.2`).

"Out of host capacity" xətası: bir neçə saat sonra və ya başqa "Availability domain" ilə yenidən cəhd edin.

## 4. Portları açmaq (OCI security list)

Instance səhifəsi -> **Primary VNIC -> Subnet** linki -> **Security Lists -> Default Security List** ->
**Add Ingress Rules** (hər biri ayrıca sətir):

| Source CIDR | IP Protocol | Destination Port | Niyə |
|---|---|---|---|
| `0.0.0.0/0` | TCP | `80` | Let's Encrypt yoxlaması, HTTPS-ə yönləndirmə |
| `0.0.0.0/0` | TCP | `443` | HTTPS |
| `0.0.0.0/0` | UDP | `443` | HTTP/3 (istəyə bağlı) |

Port 22 (SSH) standart olaraq açıqdır. Daha təhlükəsiz: həmin qaydada Source CIDR-i öz IP-nizə dəyişin
(`<sizin-ip>/32`); IP-niz dəyişəndə qaydanı yeniləyin. VM-in öz firewall-u (iptables) `setup-vm.sh` ilə
açılır (bölmə 6).

## 5. Pulsuz ad: DuckDNS

1. <https://www.duckdns.org> -> GitHub və ya Google ilə daxil olun.
2. **sub domain**: `jeparla` (məşğuldursa başqa ad, məs. `jeparla-az`) -> **add domain**.
3. **current ip** sahəsinə VM-in public IP-sini yazın -> **update ip**.
4. Yoxlama (sizin kompüterdə): `nslookup jeparla.duckdns.org`, `nslookup api.jeparla.duckdns.org`,
   `nslookup s3.jeparla.duckdns.org` hamısı VM-in IP-sini qaytarmalıdır (DuckDNS alt adları da eyni IP-yə
   yönəldir).

Səhifədəki **token** gizlidir və burada lazım deyil (IP-ni əl ilə yazırıq, VM-də yeniləyici yoxdur).
Oracle-in public IP-si instansiya silinməyənə qədər dəyişmir; dəyişərsə 3-cü addımı təkrarlayın.

**Ehtiyat variant (hesabsız): sslip.io.** `141-147-1-2.sslip.io` avtomatik olaraq `141.147.1.2`-yə
yönəlir, alt adları da. `.env`-də: `SITE_DOMAIN=141-147-1-2.sslip.io`, `API_DOMAIN=api.141-147-1-2.sslip.io`,
`S3_DOMAIN=s3.141-147-1-2.sslip.io`. Mənfi cəhəti: ünvan IP-yə bağlıdır və təqdimatda gözəl görünmür.

## 6. VM-i hazırlamaq (bir dəfə)

Sizin kompüterdə:

```powershell
ssh -i $HOME\.ssh\jeparla_oracle ubuntu@<VM-in-IP-si>
```

VM-də:

```bash
curl -fsSL https://raw.githubusercontent.com/codelady-ship/jeparla/main/deploy/scripts/setup-vm.sh -o setup-vm.sh
less setup-vm.sh      # oxuyun, q ilə çıxın
bash setup-vm.sh
exit                  # docker qrupu üçün çıxıb yenidən daxil olun
```

Skript Docker və compose plugin-i, git, gnupg, aws CLI quraşdırır, 80/443 portlarını VM-in iptables
qaydalarında açır (Oracle Ubuntu imicində `ufw` tövsiyə olunmur), SSH-da parol girişini bağlayır, 4 GB swap
əlavə edir və reponu `/opt/jeparla`-ya klonlayır.

Repo private olarsa: `curl` əvəzinə faylı özünüz köçürün (`scp -i $HOME\.ssh\jeparla_oracle deploy\scripts\setup-vm.sh ubuntu@<IP>:`),
`git clone` üçün GitHub-da **Settings -> Developer settings -> Fine-grained tokens** (yalnız bu repo,
Contents: Read-only) yaradın və klon zamanı parol yerinə yazın.

## 7. Env dəyişənləri və sirlər (VM-də)

```bash
cd /opt/jeparla
cp deploy/.env.example deploy/.env
deploy/scripts/gen-secrets.sh     # boş sirləri təsadüfi dəyərlərlə doldurur (openssl rand -hex 32)
nano deploy/.env                  # aşağıdakı cədvəl üzrə yoxlayın, Ctrl+O, Enter, Ctrl+X
```

| Dəyişən | Haradan gəlir |
|---|---|
| `SITE_DOMAIN`, `API_DOMAIN`, `S3_DOMAIN` | DuckDNS adı (bölmə 5): `jeparla.duckdns.org`, `api.jeparla.duckdns.org`, `s3.jeparla.duckdns.org` |
| `JEPARLA_JWT_SECRET`, `JEPARLA_FRONTEND_TOKEN`, `JEPARLA_DB_*_PASSWORD`, `JEPARLA_REDIS_PASSWORD`, `JEPARLA_S3_SECRET_KEY`, `JEPARLA_INTERNAL_JOB_TOKEN`, `JEPARLA_PSEUDONYM_KEY` | `gen-secrets.sh` yaradır. Əl ilə istəsəniz: `openssl rand -hex 32`. `JEPARLA_PSEUDONYM_KEY` dəyişməməlidir (köhnə psevdonimlər onunla tutuşdurulur), surəti VM-dən kənarda saxlanılsın |
| `JEPARLA_OPERATOR_NAME`, `JEPARLA_OPERATOR_TAX_ID`, `JEPARLA_OPERATOR_ADDRESS` | operatorun hüquqi adı, VÖEN-i və ünvanı (hüquqi səhifələrdə görünür, `docs/legal/analysis.md`). Boşdursa səhifədə "[sahibin məlumatı]" yazılır |
| `COMPOSE_PROFILES` | `local-s3` (standart, şəkillər VM-də). R2-yə keçid: bölmə 13 |
| `JEPARLA_SUPPORT_EMAIL` və ya `JEPARLA_SUPPORT_URL` | dəstək ünvanınız (məs. WhatsApp linki); saytın /help səhifəsində də görünür |
| `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION` | indi boş; bölmə 14 |
| `JEPARLA_SMTP_*`, `JEPARLA_MAIL_FROM` | istəyə bağlı (domen alınandan sonra). Boşdursa məktublar outbox-da gözləyir |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | istəyə bağlı (docs/operations.md) |

`JEPARLA_FRONTEND_TOKEN` həm sayta, həm API-yə eyni fayldan gedir; ayrıca yerə köçürmək lazım deyil.
`deploy/.env` faylının icazəsi 600-dür (skriptlər özü qoyur). Faylın surətini yalnız parol menecerində
saxlayın.

`SPRING_FLYWAY_OUT_OF_ORDER=false` saxlayın: `application.yml` inkişaf bazaları üçün miqrasiyaları sıradan
kənar qəbul edir (V45/V46 V50/V51-dən sonra gəlib), istehsalda isə ilk açılış hamısını sıra ilə işlədir və
sonra tətbiq olunmuş versiyadan kiçik nömrəli yeni miqrasiya API-nin açılışını aydın xəta ilə dayandırır.

**Diqqət:** verilənlər bazası parolları ilk açılışda rollara yazılır. Sonradan `.env`-də dəyişmək kifayət
etmir (backend/README.md, "Verilənlər bazası rolları").

## 8. İlk deploy

```bash
cd /opt/jeparla
deploy/scripts/deploy.sh
```

Skript ardıcıllıqla:

1. API image-ini VM-də qurur (Gradle, ilk dəfə 5-10 dəqiqə) və PostgreSQL, Redis, S3, API, Caddy-ni başladır.
   Flyway miqrasiyaları API açılanda işləyir. API `healthy` olana qədər gözləyir.
2. Caddy `api.` adı üçün sertifikat alana qədər gözləyir.
3. Sayt image-ini qurur (Next.js build, 5-10 dəqiqə). Build kataloqu **canlı API-dən** oxuyur (ana səhifə
   bölmələri, kateqoriyalar, sitemap), ona görə API-dən sonra gəlir. API cavab vermirsə, `prebuild`
   (`frontend/scripts/check-api.mjs`) build-i dərhal aydın mesajla dayandırır; işləyən köhnə sayt
   konteyneri dəyişmir.
4. Saytı başladır, sağlamlığı yoxlayır və sonda yoxlama ünvanlarını çap edir.

Sertifikat alınmırsa: `docker compose -f deploy/docker-compose.prod.yml logs caddy` (adətən 80-ci port
bağlıdır: bölmə 4 və 6, və ya DuckDNS IP-si səhvdir).

## 9. Sayt niyə Cloudflare Workers-də deyil (2026-11-16 yoxlaması)

Plan (#8) saytı Cloudflare Workers Free-də (OpenNext) saxlamaq idi. Lokal yoxlamanın nəticəsi:

- `@opennextjs/cloudflare` 1.20.17 `next >= 16.4.5` tələb edir (bizdə 16.4.4 idi). Next 16.4.6 ilə OpenNext
  build-i keçdi (526 səhifə), worker 16 MB (gzip 3.5 MB; Cloudflare-in bugünkü limiti 64 MB sıxılmamış).
- **Cache Components ilə işləmir, əgər keş anbarı qoşulmayıbsa.** Standart (keşsiz) rejimdə `workerd`-də
  bütün Cache Components səhifələri (`/az`, kataloq, məhsul, giriş) 500 qaytardı: "code had hung" və
  "promise was created by a request that has since ended". Yalnız `sitemap.xml` işlədi.
- İşləyən yeganə pulsuz rejim (Workers static assets keşi) build anındakı səhifələri verir, amma
  **revalidasiya etmir**: gündəlik metal qiymətləri və yeni məhsullar növbəti deploy-a qədər köhnə qalardı.
- Revalidasiya üçün keş anbarı lazımdır: R2 (kart tələb edə bilər) və ya Workers KV (pulsuz planda gündə
  1000 yazma; hər deploy təxminən 500 səhifəni yazır, məhsul artdıqca daha çox).
- Əlavə risklər: Workers Free-də sorğu başına 10 ms CPU limiti, `proxy.ts` (Node middleware) OpenNext-də
  "experimental", OpenNext Windows-u tam dəstəkləmir.

Ona görə sayt **eyni Oracle VM-də** konteynerdə işləyir (`frontend/Dockerfile`, Next.js `standalone`,
`NEXT_OUTPUT=standalone` yalnız image build-ində). Üstünlükləri: CPU limiti yoxdur, Next.js keşi tam işləyir
(qiymətlər `cacheLife` ilə yenilənir), build VM-də API-nin yanında olur, Windows-dan heç nə qurulmur, bütün
sistem bir əmrlə yenilənir. Mənfi cəhəti: CDN yoxdur (səhifələr Frankfurtdan gəlir); domen alınanda
Cloudflare DNS proxy (narıncı bulud) pulsuz CDN və DDoS qorunması kimi qoşula bilər (bölmə 14).

Cloudflare Workers-ə sonra qayıtmaq mümkündür: R2 aktiv olanda OpenNext-in `r2IncrementalCache` +
`doQueue` rejimini yenidən yoxlayın (<https://opennext.js.org/cloudflare/caching>).

## 10. Smoke test (hər deploy-dan sonra)

| URL | Gözlənilən |
|---|---|
| `https://api.jeparla.duckdns.org/actuator/health` | 200, `"UP"` |
| `https://api.jeparla.duckdns.org/api/v1/categories` | JSON |
| `https://api.jeparla.duckdns.org/api/v1/metal-prices/latest` | JSON (ilk AMB yüklənməsindən sonra) |
| `https://jeparla.duckdns.org/az` | ana səhifə, "Nümunə data" banneri **yoxdur** |
| `https://jeparla.duckdns.org/en`, `/ru` | dil dəyişir |
| `https://jeparla.duckdns.org/sitemap.xml` | XML, linklər `https://jeparla.duckdns.org/...` |
| `https://jeparla.duckdns.org/robots.txt`, `/llms.txt` | mətn, sitemap linki var |
| Qeydiyyat, daxil olma, çıxış | ilk cəhddə işləyir |
| Satıcı: məhsula şəkil yükləmə | şəkil `https://s3.jeparla.duckdns.org/...`-dan açılır |

Komanda sətrindən: `curl -fsS https://api.jeparla.duckdns.org/actuator/health && curl -fsSI https://jeparla.duckdns.org/az`.

Uptime monitorinqi (UptimeRobot və ya Better Stack free): docs/operations.md, bölmə 2.

## 11. Yeniləmə

- Yeni kod `main`-də olanda VM-də: `/opt/jeparla/deploy/scripts/deploy.sh`. Skript `git pull --ff-only`
  edir, API-ni, sonra saytı yenidən qurur, yalnız dəyişən konteynerləri yenidən başladır və sağlamlığı
  yoxlayır. Miqrasiya uğursuz olarsa skript xəta ilə bitir, PostgreSQL və data toxunulmaz qalır.
- Yalnız `.env` dəyişibsə: `SKIP_PULL=1 deploy/scripts/deploy.sh`.
- Əvvəlki versiyaya qayıtmaq: `cd /opt/jeparla && git checkout <köhnə-commit> && SKIP_PULL=1 deploy/scripts/deploy.sh`,
  sonra `git checkout main`. Miqrasiyalar geri qayıtmır: yeni miqrasiyalı versiyadan qayıtmazdan əvvəl
  backup götürün (bölmə 13).
- GitHub Actions deploy yoxdur: Actions hazırda billing səbəbindən bloklanıb. Hər şey əl ilə işləyir.

## 12. Oracle idle-reclaim riski

Oracle Always Free instansiyanı 7 gün ərzində **hamısı** doğru olarsa "idle" sayıb geri ala bilər: CPU
(95-ci persentil) < 20%, şəbəkə < 20%, yaddaş < 20% (yalnız A1). Mənbə: Oracle Always Free səhifəsi
(bölmə 0). Az ziyarətçi olan demo saytda bu real riskdir.

Tədbirlər:

1. **Pay As You Go** (bölmə 1.4). Rəsmi səhifə qaydanı "Always Free compute instances" üçün yazır; PAYG-nin
   tam istisna olduğunu açıq demir. Hesab açılanda şərtləri yenidən oxuyun. 1 USD büdcə xəbərdarlığı mütləqdir.
2. **Yaddaş**: üç meyarın hamısı lazımdır, ona görə yaddaş 20%-dən (12 GB-nin 2.4 GB-ı) yuxarı olsa,
   instansiya idle sayılmır. JVM, PostgreSQL `shared_buffers`, Next.js serveri və Silo birlikdə adətən bu
   həddən yuxarıdır; deploy-dan bir gün sonra `free -h` ilə yoxlayın ("used" 2.4 GB-dan çox olmalıdır).
3. **Gecəlik backup** (bölmə 13) VM-dən kənarda: instansiya itsə, data itmir.
4. **30 dəqiqəlik bərpa**: bölmə 3-8-i təkrarlayın (`deploy/.env` parol menecerindən), sonra bölmə 13-dəki
   bərpa. DB parolları backup-dakı rollara uyğun gəlməlidir, ona görə köhnə `.env` istifadə olunur.

## 13. Backup və saxlama

Skriptlər: `docker/backup/pg-backup.sh` və `docker/backup/pg-restore-test.sh` (#56, #209), onları istehsal
compose faylı ilə işə salan `deploy/scripts/backup.sh`. Dump `gpg` (AES256) ilə şifrələnir və VM-dən kənar
S3 uyğun bucket-ə yüklənir.

**Bucket: Oracle Object Storage (pulsuz 20 GB, əlavə kart tələbi yoxdur) və ya Cloudflare R2.**

Oracle Object Storage:

1. Console -> **Storage -> Buckets -> Create Bucket**: `jeparla-backups`, Standard, public deyil.
2. Bucket -> **Lifecycle Policy Rules -> Create Rule**: Delete, 14 gün, prefiks `postgres/`.
3. Sağ yuxarı profil -> **My profile -> Customer secret keys -> Generate secret key**: açar yalnız bir dəfə
   göstərilir; birbaşa VM-dəki fayla (aşağıda) yazın.
4. Namespace: profil -> **Tenancy** -> **Object storage namespace**.

VM-də:

```bash
openssl rand -base64 32 > ~/.jeparla-backup-pass && chmod 600 ~/.jeparla-backup-pass
nano ~/.jeparla-backup.env && chmod 600 ~/.jeparla-backup.env
```

`~/.jeparla-backup.env`:

```
BACKUP_PASSPHRASE_FILE=/home/ubuntu/.jeparla-backup-pass
BACKUP_S3_BUCKET=jeparla-backups
BACKUP_S3_ENDPOINT=https://<namespace>.compat.objectstorage.eu-frankfurt-1.oraclecloud.com
BACKUP_S3_REGION=eu-frankfurt-1
AWS_ACCESS_KEY_ID=<customer secret key: Access Key>
AWS_SECRET_ACCESS_KEY=<customer secret key: Secret Key>
```

R2 ilə: `BACKUP_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `BACKUP_S3_REGION` yazılmır
(standart `auto`), açar yalnız bu bucket-ə yazan R2 API token-indən. Ətraflı: docs/operations.md, bölmə 3.

`~/.jeparla-backup-pass` faylının surəti **parol menecerində** olmalıdır: onsuz heç bir backup açılmır.

Yoxlama və cron:

```bash
/opt/jeparla/deploy/scripts/backup.sh                 # bir dəfə əl ilə: "backup ok: ..." çap etməlidir
/opt/jeparla/deploy/scripts/backup.sh restore-test    # müvəqqəti konteynerə bərpa, canlı bazaya toxunmur
crontab -e
# əlavə edin (UTC 02:00 = Bakı 06:00):
0 2 * * * /opt/jeparla/deploy/scripts/backup.sh >> /home/ubuntu/jeparla-backup.log 2>&1
```

Bərpa testinin çap etdiyi sətri docs/operations.md-dəki bərpa jurnalına əlavə edin.

**Şəkillər** (`local-s3` rejimi) VM-in `s3-data` volume-undadır və bu backup-a daxil deyil. Real satıcı
şəkilləri gələndə R2-yə keçin və ya şəkillər üçün ayrıca nüsxə qurun (`mc mirror` -> Object Storage).

**R2-yə keçid (yalnız env):** R2-də iki bucket (`jeparla-public` public, `jeparla-private` private;
private bucket-də sayt origin-indən PUT üçün CORS və `staging/` üçün 1 gün lifecycle, backend/README.md),
API token. `deploy/.env`-də `COMPOSE_PROFILES=` (boş) və `.env.example`-dakı R2 blokunu doldurun, sonra
`SKIP_PULL=1 deploy/scripts/deploy.sh`. Köhnə şəkilləri köçürmək: `mc mirror`.

## 14. Real domenə keçid (sonra)

1. Domeni alın (məs. `jeparla.az`). DNS-də üç `A` qeydi VM-in IP-sinə: `@` (və ya `www`), `api`, `s3`.
   DNS Cloudflare-dədirsə, əvvəlcə **DNS only** (boz bulud) saxlayın ki, Caddy sertifikat ala bilsin.
2. VM-də `deploy/.env`: `SITE_DOMAIN=jeparla.az`, `API_DOMAIN=api.jeparla.az`, `S3_DOMAIN=s3.jeparla.az`,
   sonra `SKIP_PULL=1 deploy/scripts/deploy.sh` (sayt yeni ünvanla yenidən qurulur: canonical, sitemap,
   CORS, e-poçt linkləri).
3. **Google Search Console** -> Add property -> **Domain** -> verilən `google-site-verification=...` TXT
   qeydini DNS-ə əlavə edin -> Verify. Bu üsulda env lazım deyil. URL-prefix üsulu ilə **HTML tag**
   seçsəniz: `content="..."` dəyərini `deploy/.env`-də `GOOGLE_SITE_VERIFICATION`-a yazın (Bing üçün
   `BING_SITE_VERIFICATION`) və `SKIP_PULL=1 deploy/scripts/deploy.sh`. Sonra `https://jeparla.az/sitemap.xml`
   göndərin (#62).
4. İstəyə bağlı: sertifikatlar alınandan sonra Cloudflare-də sayt qeydini **Proxied** (narıncı bulud) edin
   (pulsuz CDN). Bu halda Cloudflare-də SSL rejimi **Full (strict)** olmalıdır.
5. DuckDNS ünvanı işləməyə davam edir; canonical linklər yeni domenə keçir.

## 15. Problemlər

| Əlamət | Səbəb və həll |
|---|---|
| Sertifikat alınmır | 80/443 bağlıdır: security list (bölmə 4) və `sudo iptables -L INPUT -n --line-numbers` (ACCEPT qaydaları REJECT-dən əvvəl olmalıdır); DuckDNS IP-si səhvdir |
| `deploy.sh` sayt build-ində "does not answer" ilə dayanır | API işləmir və ya sertifikat hələ yoxdur: `curl https://api.<ad>/actuator/health`, `docker compose -f deploy/docker-compose.prod.yml logs caddy api` |
| Saytda giriş işləmir, brauzer konsolunda CORS | `SITE_DOMAIN` brauzerdə açdığınız ünvanla eyni deyil |
| Şəkil yüklənmir | `S3_DOMAIN` DNS-i və sertifikatı; `docker compose -f deploy/docker-compose.prod.yml logs s3` |
| API `unhealthy` | `docker compose -f deploy/docker-compose.prod.yml logs --tail 200 api` |
| Yaddaş azdır | `docker stats --no-stream`; limitlər compose faylında `mem_limit` |

## 16. v1 qəbul nəticələri (#47, #62)

| Tarix | Yoxlama | Nəticə |
|---|---|---|
| _hələ aparılmayıb_ | Lighthouse mobil və desktop (canlı URL) | |
| _hələ aparılmayıb_ | Rich Results Test, `robots.txt`, `llms.txt` | |
| _hələ aparılmayıb_ | Bərpa testi (bölmə 13) | |
| _hələ aparılmayıb_ | 1 saat istifadəsiz qaldıqdan sonra giriş < 1 s (#45) | |
