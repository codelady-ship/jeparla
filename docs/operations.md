# Əməliyyat: monitorinq, backup və bərpa (#56)

Canlı mühit: backend, PostgreSQL və Redis Oracle Cloud VM-də Docker Compose ilə işləyir (PLAN 3a). Bütün açarlar
yalnız env-dədir (VM-də `.env`, frontend hostinqinin env ayarları). Repoda heç bir açar yoxdur.

## 1. Xəta izləmə: Sentry Free

| Hissə | Necə | Env |
|---|---|---|
| Backend | `io.sentry:sentry-spring-boot-4-starter`, `application.yml` -> `sentry.*` | `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` |
| Frontend | SDK-sız kiçik reporter (`src/lib/monitoring/report-error.ts`), `[locale]/error.tsx` çağırır. SDK skript büdcəsinə (250 KB) sığmır | `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_RELEASE` |

- DSN boşdursa, Sentry işləmir (lokal, testlər, CI).
- Məxfilik: `send-default-pii: false`, request body göndərilmir (sənədlər, şifrələr). Frontend URL-i sorğu sətri
  olmadan göndərir (axtarış sözləri getmir). Sentry layihəsində **"Prevent storing of IP addresses"** açılmalıdır.
- Performans izləmə (traces) bağlıdır: pulsuz limit yalnız xətalara xərclənir.
- Sentry-də alert: "a new issue is created" -> sahibin e-poçtu.

## 2. Uptime alert

Pulsuz xarici yoxlayıcı (məsələn UptimeRobot və ya Better Stack free), hər 5 dəqiqədən bir:

| Yoxlama | URL | Gözlənilən |
|---|---|---|
| API | `https://<api-domeni>/actuator/health` | 200, mətn `"UP"` |
| Sayt | `https://<sayt-domeni>/az` | 200 |
| Metal qiyməti | `https://<api-domeni>/api/v1/metal-prices/latest` | 200 |

- Alert: e-poçt (və ya Telegram), 2 ardıcıl uğursuz yoxlamadan sonra.
- `/actuator/health` yalnız `health`-i açır (`management.endpoints.web.exposure.include: health`). Redis
  sağlamlığa daxil deyil (opsionaldır, PLAN 3a).
- Seçilən xidmət və alert alıcısı: **sahib qərar verəcək** (bu PR hesab açmır).

## 3. Backup: gecəlik `pg_dump` -> R2, 14 gün

Skript: `docker/backup/pg-backup.sh`. O, `pg_dump -Fc` çıxarır, `gpg --symmetric` (AES256) ilə şifrələyir və
ayrıca private R2 bucket-ə yükləyir.

VM-də bir dəfə:

1. Paketlər: `sudo apt-get install -y gnupg awscli` (və ya aws CLI v2).
2. R2-də ayrıca bucket (məs. `jeparla-backups`, public deyil) və yalnız o bucket-ə yazan API token.
3. Lifecycle rule: `postgres/` prefiksi, **14 gündən sonra sil**. Köhnə nüsxələri skript silmir: sınan cron heç vaxt backup silmir.
4. Şifrə: `openssl rand -base64 32 > ~/.jeparla-backup-pass && chmod 600 ~/.jeparla-backup-pass`.
   **Bu faylın surəti VM-dən kənarda (parol meneceri) saxlanılmalıdır**: onsuz heç bir backup bərpa olunmur.
5. `~/.jeparla-backup.env` (chmod 600):
   ```
   BACKUP_PASSPHRASE_FILE=/home/ubuntu/.jeparla-backup-pass
   BACKUP_S3_BUCKET=jeparla-backups
   BACKUP_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   ```
6. Cron (UTC 02:00; repo qovluğundan):
   ```
   0 2 * * * cd /opt/jeparla && set -a && . ~/.jeparla-backup.env && set +a && docker/backup/pg-backup.sh >> ~/jeparla-backup.log 2>&1
   ```
7. Backup uğursuz olarsa xəbər üçün: uptime xidmətinin "heartbeat" (cron monitor) URL-i skriptin sonuna
   `&& curl -fsS <heartbeat-url>` kimi əlavə oluna bilər.

## 4. Bərpa testi

Skript: `docker/backup/pg-restore-test.sh`. O, ən son (və ya verilən) backup-ı endirir, açır və **ayrıca, müvəqqəti**
`postgres:16-alpine` konteynerinə `pg_restore` edir. Canlı bazaya toxunmur. Sonra Flyway versiyasını və cədvəl/sətir
saylarını yoxlayır, konteyneri silir və jurnal üçün bir sətir çap edir.

```
cd /opt/jeparla && set -a && . ~/.jeparla-backup.env && set +a && docker/backup/pg-restore-test.sh
```

Qayda: ilk backup-dan sonra, sonra ayda bir dəfə və hər böyük miqrasiyadan sonra. Çap olunan sətir aşağıdakı cədvələ
əlavə olunur (PR ilə).

Canlı bazanı həqiqətən bərpa etmək lazım olsa: backend-i dayandırın (`docker compose stop backend`), boş bazaya
`pg_restore --no-owner --no-acl` edin, rolları `docker/postgres/10-jeparla-roles.sh` və V16 qrantları ilə yoxlayın,
sonra backend-i başladın. Bu addımlar ilk real bərpa testindən sonra dəqiqləşdiriləcək.

### Bərpa jurnalı

| Tarix (UTC) | Backup | Yoxlama | Müddət | Nəticə |
|---|---|---|---|---|
| _hələ aparılmayıb_ | | | | Canlı VM və R2 hələ qurulmayıb. Qəbul meyarı ("bərpa testi uğurla aparılıb və tarixi yazılıb") ilk testdən sonra ödənir. |

## 5. Hüquqi səhifələr

`/legal/privacy`, `/legal/terms`, `/legal/cookies` (az, en, ru): mətn `frontend/src/content/legal/` qovluğundadır.
Faktlar (hansı məlumat saxlanılır, provayderlər, cookie-lər) kodun bugünkü vəziyyətinə uyğundur. Hüquqi hissələr
(hüquqi əsas, saxlama müddəti, məsuliyyət, operatorun rekvizitləri) **"Təsdiq gözlənilir"** qeydi ilə boş saxlanılıb.
Sahib və hüquqşünas (#57) təsdiqləyənə qədər:

- səhifələrin yuxarısında "Qaralama" bildirişi var və səhifələr `noindex`-dir (`LEGAL_DRAFT = true`);
- yeni provayder (məs. analitika) əlavə olunanda məxfilik siyasətindəki provayder siyahısı da yenilənməlidir.
