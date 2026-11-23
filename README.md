# Jeparla

Qızıl, gümüş və brilyant zərgərlik mağazaları üçün çoxmağazalı kataloq.

**Canlı sayt:** [jeparla.duckdns.org/az](https://jeparla.duckdns.org/az)

<p>
  <img src="./docs/screenshots/home-desktop.webp" alt="Jeparla ana səhifəsi, kompüter" width="640">
  <img src="./docs/screenshots/home-mobile.webp" alt="Jeparla ana səhifəsi, telefon" width="180">
</p>

- Mağaza və kateqoriya üzrə axtarış, əyar, çəki, qiymət və brilyant parametrləri ilə filtrlər
- AMB-nin gündəlik metal məzənnəsi və metala bağlı avtomatik qiymət
- Jeparla Verified: satıcı, sənəd və ekspertiza statusları ayrı-ayrılıqda
- Mağaza kabineti, admin paneli, WhatsApp ilə əlaqə
- Az / En / Ru, gecə və gündüz rejimi

Layihə qurulma mərhələsindədir. Plan: [docs/PLAN.md](./docs/PLAN.md),
qaydalar: [CLAUDE.md](./CLAUDE.md), backlog: [BACKLOG.md](./BACKLOG.md).

## Struktur

```
frontend/   Next.js 16 + TypeScript
backend/    Java 21 + Spring Boot 4 + PostgreSQL 16
docs/       plan, dizayn, rollar, deploy, araşdırma
tools/      contrast.py (WCAG), sweep.py (köhnə ad yoxlaması)
```

## Lokal mühit

Bütün dəyişənlər [`.env.example`](./.env.example)-dadır. Əvvəlcə surətini çıxarın və boş qalan
şifrə və açarları doldurun (yalnız hərf və rəqəm; S3 secret ən azı 8 simvol; `JEPARLA_JWT_SECRET`
ən azı 32 simvol, məsələn `openssl rand -hex 32`):

```bash
cp .env.example .env
```

`.env` gitignore-dadır: sirlər repoya düşmür. Prod-da eyni dəyişənlər serverdəki `.env`-dən
(600 icazə) və GitHub Secrets-dən gəlir.

### Docker ilə

Docker Engine və Compose v2 lazımdır. Bir əmr bütün stack-i qaldırır:

```bash
docker compose up -d --build
docker compose ps          # hamısı healthy olmalıdır, minio-init isə "exited (0)"
```

| Servis | Ünvan | Qeyd |
| --- | --- | --- |
| backend | http://localhost:8080/actuator/health | `backend/Dockerfile`-dan qurulur |
| postgres | `localhost:5432` | PostgreSQL 16, verilənlər `postgres-data` volume-unda |
| redis | `localhost:6379` | Redis 7, yalnız keş və rate limit |
| minio | http://localhost:9000 (S3), http://localhost:9001 (konsol) | R2-nin lokal əvəzi; `minio-init` public və private bucket-ləri yaradır |

PostgreSQL boş volume ilə ilk dəfə başlayanda `docker/postgres/10-jeparla-roles.sh` miqrasiya və iş rollarını
yaradır (#165); API superuser kimi qoşulmur. Köhnə (tək istifadəçili) volume üçün `docker compose down -v`.

Portlar yalnız `127.0.0.1`-ə bağlanır, şəbəkədən görünmür. Faydalı əmrlər:

```bash
docker compose logs -f backend            # API logları
docker compose up -d --build backend      # kod dəyişəndən sonra yalnız API-ni yenidən qur
docker compose down                       # dayandır (verilənlər qalır)
docker compose down -v                    # dayandır və bütün verilənləri sil
```

### Docker-siz

1. JDK 21, PostgreSQL 16 (`pg_trgm` üçün contrib paketi ilə) və istəyə görə Redis 7 quraşdırın.
2. `.env`-dəki ad və şifrələrlə iki rol və baza yaradın: miqrasiya rolu (bazanın sahibi, yalnız Flyway) və
   API-nin iş rolu (superuser deyil, heç nəyin sahibi deyil; #165, [backend/README.md](./backend/README.md)
   "Verilənlər bazası rolları"):

   ```bash
   psql -U postgres -c "CREATE ROLE jeparla_owner LOGIN NOSUPERUSER PASSWORD '...';"
   psql -U postgres -c "CREATE ROLE jeparla_app LOGIN NOSUPERUSER PASSWORD '...';"
   psql -U postgres -c "CREATE DATABASE jeparla OWNER jeparla_owner;"
   ```

   V15-ə qədər tək `jeparla` istifadəçisi ilə qurulmuş bazanı yenidən yaradın və ya backend README-dəki keçid
   addımlarını edin: miqrasiya iş rolu olmadan dayanır.

3. `.env`-i yükləyib API-ni qaldırın (Git Bash, Linux, macOS; Windows PowerShell üçün aşağıya baxın):

   ```bash
   set -a; . ./.env; set +a
   cd backend && ./gradlew bootRun
   ```

Redis olmadan API işləməyə davam edir. Şəkil yükləməni yoxlamaq üçün yalnız MinIO-nu Docker ilə
qaldırmaq olar: `docker compose up -d minio minio-init`. Ətraflı: [backend/README.md](./backend/README.md).

#### Windows (Docker-siz, PowerShell)

Təmiz Windows maşınında `/actuator/health`-ə qədər addımlar. Əmrlər repo kökündən, PowerShell-dən.

1. **Quraşdırma:** JDK 21 (məsələn Microsoft Build of OpenJDK; `java -version` 21 göstərməlidir) və
   PostgreSQL 16 (EDB installer; `pg_trgm` daxil olan contrib paketi onunla gəlir). Redis lazım deyil:
   onsuz rate limit sayğacları yaddaşda saxlanılır.
2. **`psql`-in yeri:** standart quraşdırmada PATH-da deyil. Cari pəncərə üçün əlavə edin:

   ```powershell
   $env:Path += ";C:\Program Files\PostgreSQL\16\bin"
   psql --version
   ```

3. **Rollar və baza.** Baza mütləq UTF8 olmalıdır: V1 miqrasiyasında Azərbaycan və kiril hərfləri var,
   Windows-da isə default kodlaşdırma çox vaxt `WIN1252`/`WIN1254` olur və miqrasiya dayanır. `template0`
   ilə yaradın (Windows-da UTF8 istənilən locale ilə işləyir). Parollar `.env`-dəki
   `JEPARLA_DB_MIGRATION_PASSWORD` və `JEPARLA_DB_PASSWORD` ilə eyni olsun:

   ```powershell
   psql -U postgres -c "CREATE ROLE jeparla_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '...';"
   psql -U postgres -c "CREATE ROLE jeparla_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '...';"
   psql -U postgres -c "CREATE DATABASE jeparla OWNER jeparla_owner ENCODING 'UTF8' TEMPLATE template0;"
   psql -U postgres -d jeparla -c "REVOKE ALL ON DATABASE jeparla FROM PUBLIC; GRANT CONNECT, TEMPORARY ON DATABASE jeparla TO jeparla_app;"
   psql -U postgres -d jeparla -c "SHOW server_encoding;"   # UTF8
   ```

4. **`.env`:** `Copy-Item .env.example .env`, sonra boş sirləri doldurun (yuxarıdakı qaydalar;
   `JEPARLA_JWT_SECRET` üçün `openssl` yoxdursa:
   `-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })`).
5. **`.env`-i yükləyib API-ni qaldırın** (dəyişənlər yalnız bu PowerShell pəncərəsində qalır; boş dəyərlər
   təyin olunmur, API öz default-unu götürür):

   ```powershell
   Get-Content .env | Where-Object { $_ -match '^\s*[A-Za-z_][A-Za-z0-9_]*=' } | ForEach-Object {
     $name, $value = $_ -split '=', 2
     [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), 'Process')
   }
   cd backend
   .\gradlew.bat bootRun
   ```

   Başqa pəncərədə: `Invoke-RestMethod http://localhost:8080/actuator/health` cavabı `status: UP` olmalıdır.

6. **Şəkil yükləmə (S3):** Docker-siz, `.env`-də `JEPARLA_S3_ACCESS_KEY` və `JEPARLA_S3_SECRET_KEY` boş qalsa yükləmə
   endpoint-ləri 503 qaytarır, qalan hər şey işləyir. Yükləməni yoxlamaq lazımdırsa, lokal S3 serverini
   (compose-dakı `pgsty/silo` ilə eyni proqram) Windows binarı ilə qaldırmaq olar:
   [github.com/pgsty/silo/releases](https://github.com/pgsty/silo/releases)-dən `silo_*_windows_amd64.zip`
   (`silo.exe`) və [github.com/pgsty/mc/releases](https://github.com/pgsty/mc/releases)-dən
   `mcli_*_windows_amd64.zip` (`mcli.exe`). `.env` yüklənmiş pəncərədə:

   ```powershell
   $env:MINIO_ROOT_USER = $env:JEPARLA_S3_ACCESS_KEY
   $env:MINIO_ROOT_PASSWORD = $env:JEPARLA_S3_SECRET_KEY
   .\silo.exe server C:\jeparla-s3 --address 127.0.0.1:9000 --console-address 127.0.0.1:9001
   ```

   Bucket-lər (ikinci pəncərədə, eyni `.env` ilə; `minio-init` servisi ilə eyni addımlar):

   ```powershell
   .\mcli.exe alias set local http://127.0.0.1:9000 $env:JEPARLA_S3_ACCESS_KEY $env:JEPARLA_S3_SECRET_KEY
   .\mcli.exe mb --ignore-existing local/jeparla-public local/jeparla-private
   .\mcli.exe anonymous set download local/jeparla-public
   ```

   Bu yol CI-da yoxlanılmır; işləməsə yükləməni Docker olan maşında yoxlayın. `staging/` üçün 1 günlük
   silmə qaydası burada yoxdur (API-nin təmizləmə işi yenə işləyir).
7. **Testlər:** `.\gradlew.bat test` Docker-siz işləyir, amma PostgreSQL və Redis tələb edən testlərin demək olar
   hamısı (Testcontainers, `disabledWithoutDocker`) **keçilir** (skipped), yalnız unit testlər işləyir. Yaşıl nəticə
   burada tam yoxlama demək deyil; tam test dəsti CI-da (Docker ilə) işləyir.

## Alətlər

```bash
python3 tools/contrast.py docs/design/tokens.json
python3 tools/sweep.py frontend --config docs/brand.json
python3 tools/sweep.py backend --config docs/brand.json
```

`tools/` içindəki skriptlər [replica-skill](https://github.com/codelady-ship/replica-skill)
layihəsindəndir (MIT, `tools/LICENSE-replica-skill.txt`).
