# Jeparla

Azərbaycanda (sonra bütün dünyada) qızıl, gümüş və brilyant zərgərlik mağazalarını bir
platformada toplayan çoxmağazalı kataloq. Alıcı mağaza və kateqoriya üzrə axtarır, məhsulun
yoxlanılmış məlumatlarını görür və WhatsApp ilə mağazaya yazır. Metal qiymətləri AMB-nin
gündəlik məzənnəsindən gəlir və satıcının "metala bağlı" qiymətləri avtomatik yenilənir.

Tam tələblər: [docs/PLAN.md](./docs/PLAN.md). Backlog: [BACKLOG.md](./BACKLOG.md).

## Layihə qaydaları (MƏCBURİ)

- **Ad:** layihənin adı yalnız **Jeparla**-dır. Köhnə adlar (Golden.az, GoldenLux, Golden Lux)
  və başqa layihələrin adları (Planera) kodda, mətndə, fayl adlarında olmamalıdır.
  `tools/sweep.py` CI-da yoxlayır (`docs/brand.json`).
- **Emoji qadağandır:** issue, commit, UI və sənədlərdə. İkonlar yalnız `lucide-react`.
- **UI kitabxanası: shadcn/ui.** Əvvəl mövcud komponent, yalnız qarşılığı yoxdursa custom.
- **Rənglər yalnız token-lərlə** (raw hex komponentdə yoxdur). Əsas palitra (2026-11 redizayn):
  charcoal `#141414`, qara `#090909`, qızılı `#C6A15B` (açıq `#E8D39A`, tünd `#8D6A2D`),
  gümüşü `#D8DCE1`, brilyant ağı `#F7F8FA`, fil sümüyü `#F5F1E8`. Mənbə: `docs/design/tokens.json`.
  Light və dark tema; `tools/contrast.py` ilə WCAG AA, 0 xəta.
- **Şriftlər:** başlıq Cormorant Garamond, mətn Manrope; Azərbaycan (Ə, İ, Ş, Ç, Ğ, Ö, Ü) və rus
  hərflərini dəstəkləməlidir.
- **3 dil əvvəldən:** az (əsas), en, ru. UI mətni kodda sərt yazılmır.
- **Pul və çəki:** PostgreSQL `NUMERIC` + Java `BigDecimal` + currency. `float`/`double` qadağandır.
- **Clean-room:** istinad saytlarının (Mejuri, Tiffany, Swarovski və s.) kodu, şəkli, videosu,
  loqosu, mətni, şrifti və imza rəngi götürülmür. Ekran görüntüləri yalnız
  `docs/research/screens/`-də və `.gitignore`-dadır.
- **Dürüstlük:** saxta rəy, saxta rəqəm, "100% zəmanət" yoxdur. AI ilə yaradılmış şəkil işarələnir.
- **Təhlükəsizlik:** rol və sahiblik backend-də yoxlanılır; sirlər yalnız env-də; açar repoda yoxdur.

## Texnoloji stack

- **Frontend** (`/frontend`): Next.js 16 (App Router), TypeScript strict, Tailwind, shadcn/ui,
  lucide-react, next-intl, Vitest, Playwright + axe.
- **Backend** (`/backend`): Java 21, Spring Boot 4, Spring Security (JWT), Spring Data JPA,
  PostgreSQL 16 + Flyway, Redis, JUnit 5 + Testcontainers. Paketlər funksiyaya görə:
  `az.jeparla.<feature>` (`auth`, `store`, `product`, `search`, `pricing`, `verification`, `admin` ...),
  hər birində `dto/`.
- **Fayllar:** S3 uyğun storage (Cloudflare R2): public şəkillər, private sənədlər.
- **Deploy (pulsuz):** frontend Cloudflare/Netlify (və ya Vercel); backend, PostgreSQL və Redis
  Oracle Cloud Always Free ARM VM-də Docker Compose + Caddy ilə. Yatan hostlar (Render free və s.)
  qadağandır: giriş sorğusu gözləyib uğursuz olur. Ətraflı: `docs/PLAN.md` bölmə 3a.
- **Keyfiyyət həddi:** Lighthouse mobil Performance >= 90, Accessibility = 100, Best Practices >= 95,
  SEO = 100 (CI yoxlayır); hər ictimai səhifədə JSON-LD və GEO qaydaları (`docs/PLAN.md` 5.18).

## Dizayn və animasiya skill-ləri

`.claude/skills/`-də (lokal, gitignore; sahibin GitHub fork-larından, MIT):
- `hallmark`: istiqamət, kompozisiya və "AI slop" yoxlaması (UI dəyişikliyindən əvvəl və sonra).
- `gsap-core`, `gsap-scrolltrigger`, `gsap-react`, `gsap-timeline`, `gsap-performance`:
  kinematik hero və scroll animasiyaları. GSAP yalnız ana səhifənin hero-sunda, dinamik import
  ilə, `gsap.matchMedia` + `prefers-reduced-motion` ilə; `useGSAP` ilə təmizlənir.
- `emil-design-eng`, `review-animations`, `animation-performance`: mikro-animasiya keyfiyyəti
  (yalnız `transform`/`opacity`, 60fps, layout thrash yoxdur).
Seçilməyənlər: impeccable (ilk işə düşəndə kənardan binar endirir), react-bits və three.js
(JS büdcəsi), framer-motion (GSAP kifayətdir).

## Repo strukturu

```
jeparla/
├── frontend/        # Next.js
├── backend/         # Spring Boot API (Gradle)
├── docs/            # PLAN.md, DESIGN.md, RBAC.md, deploy.md, brand.json, research/
├── tools/           # contrast.py, sweep.py (replica-skill, MIT)
├── BACKLOG.md       # epic / sub-issue backlog
└── CLAUDE.md
```

## Rollar (RBAC)

`ADMIN`, `MERCHANT`, `USER`. Endpoint-lər `@PreAuthorize` ilə; mağaza sahibi yalnız öz
mağazasının resurslarını dəyişir (hər sorğuda sahiblik yoxlanılır).

## Git / GitHub workflow

- Hər iş GitHub issue ilə başlayır. `main`-dən branch: `feature/...`, `fix/...`, `chore/...`, `docs/...`.
- Kiçik, məntiqi commit-lər; hər commit build/test-dən keçir. Commit mesajları ingiliscə,
  Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- Issue-lar Azərbaycan dilində, PR-lar ingiliscə; PR issue-nu bağlayır (`Closes #N`).
- PR yalnız CI yaşıl olanda merge olunur. Açıq S1/S2 bug ilə deploy yoxdur.
- Epic label-ləri: `epic:foundation`, `epic:catalog`, `epic:search` və s.
