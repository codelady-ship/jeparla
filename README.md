# Jeparla

Qızıl, gümüş və brilyant zərgərlik mağazaları üçün çoxmağazalı kataloq.

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

3. `.env`-i yükləyib API-ni qaldırın (Git Bash, Linux, macOS):

   ```bash
   set -a; . ./.env; set +a
   cd backend && ./gradlew bootRun
   ```

Redis olmadan API işləməyə davam edir. Şəkil yükləməni yoxlamaq üçün yalnız MinIO-nu Docker ilə
qaldırmaq olar: `docker compose up -d minio minio-init`. Ətraflı: [backend/README.md](./backend/README.md).

## Alətlər

```bash
python3 tools/contrast.py docs/design/tokens.json
python3 tools/sweep.py frontend --config docs/brand.json
python3 tools/sweep.py backend --config docs/brand.json
```

`tools/` içindəki skriptlər [replica-skill](https://github.com/codelady-ship/replica-skill)
layihəsindəndir (MIT, `tools/LICENSE-replica-skill.txt`).
