# Jeparla dizayn sistemi

Mənbə: [`docs/design/tokens.json`](./design/tokens.json). Ondan `frontend/src/app/tokens.css`
generasiya olunur (`npm run tokens`). Əl ilə CSS-də rəng yazılmır; komponentlərdə raw hex yoxdur.
Canlı nümunə: `/design` səhifəsi (indekslənmir).

## Rənglər (rollar)

2026-11-05 redizayn: tünd yaşıl/krem palitradan charcoal, fil sümüyü, qızılı və gümüşü
palitraya keçid (sahibin qərarı, premium kinematik vitrin).

| Rol                       | Light                           | Dark                            | İstifadə                    |
| ------------------------- | ------------------------------- | ------------------------------- | --------------------------- |
| bg                        | `#F5F1E8` fil sümüyü            | `#0B0B0B`                       | səhifə fonu                 |
| surface                   | `#FFFFFF`                       | `#141414` charcoal              | kart, dialoq, panel         |
| surface-muted             | `#ECE6D9`                       | `#1E1E1E`                       | ikinci dərəcəli fon, hover  |
| border                    | `#DDD5C4`                       | `#2C2A27`                       | incə (hairline) xətlər      |
| input                     | `#8A8170`                       | `#767676`                       | forma sərhədi (3:1)         |
| text                      | `#141414`                       | `#F5F1E8`                       | əsas mətn                   |
| text-muted                | `#5C5850`                       | `#A39E95`                       | köməkçi mətn                |
| primary / on-primary      | `#141414` / `#F5F1E8`           | `#C6A15B` / `#141414`           | əsas düymə                  |
| accent (gold) / on-accent | `#C6A15B` / `#141414`           | eyni                            | qızılı CTA, Verified nişanı |
| accent-text (gold-text)   | `#7A5B1F`                       | `#D9BE7E`                       | qızılı ikon və link         |
| ring                      | `#8D6A2D`                       | `#E8D39A`                       | fokus halqası               |
| danger, success, warning  | `#B42318`, `#1D6A43`, `#8A5300` | `#F2857B`, `#6CC896`, `#E5B45A` | status                      |

**Səhnə rəngləri (`--scene-*`, temadan asılı deyil).** Hero səhnələri öz işığını daşıyır:
`ink #090909`, `charcoal #141414`, `ivory #F5F1E8`, `ivory-muted #B8B2A7`, `gold #C6A15B`,
`gold-light #E8D39A`, `gold-deep #8D6A2D`, `silver #D8DCE1`, `diamond #F7F8FA`,
`silver-text #4A4F57`. Tailwind: `bg-scene-ink`, `text-scene-gold-light` və s.

Tailwind sinifləri: `bg-background`, `bg-card`, `bg-muted`, `bg-primary`, `bg-gold text-on-gold`,
`text-gold-text`, `text-success`, `text-warning`, `bg-destructive text-on-destructive`.

**Qızılı qaydası.** `#C6A15B` fil sümüyü fonda kifayət qədər kontrast vermir. Light temada qızılı
yalnız **fon** kimi (üzərində tünd mətn) istifadə olunur; ikon, link, xətt üçün `gold-text`.
Qızılı heç vaxt yeganə məna daşıyıcısı deyil (ikon + mətn). Ucuz qızılı qradiyent yoxdur.

**Kontrast.** `tokens.json`-dakı `pairs` siyahısındakı 66 cüt WCAG AA-dan keçir. Yoxlama:
`python3 tools/contrast.py docs/design/tokens.json` (CI) və `npm test` (eyni düstur,
`src/lib/contrast.ts`). Yeni rəng əlavə edəndə cütünü də əlavə et.

## Tema

`next-themes`, `class` atributu, standart `system`, seçim `localStorage`-da (`jeparla-theme`).
Tema skripti HTML-dən əvvəl işləyir, yanıb-sönmə olmur. İkonlar CSS ilə (`dark:`) seçilir,
hidratasiya fərqi yoxdur. Keçid düyməsi: `ThemeToggle`. Hero səhnələri hər iki temada eynidir.

## Tipoqrafiya

| Rol                            | Şrift              | Qeyd                                         |
| ------------------------------ | ------------------ | -------------------------------------------- |
| Başlıq (`font-heading`, h1–h3) | Cormorant          | variable serif (300–700), italic yoxdur      |
| Mətn (`font-sans`)             | sistem sans-serif  | şrift büdcəsi: səhifədə maks. 2 fayl         |
| Kiçik texniki nişanlar         | sistem monospace   | `font-mono`, az istifadə (tarix, mənbə)      |

Cormorant Ə İ Ş Ç Ğ Ö Ü və rus hərflərini dəstəkləyir. Şrift `next/font` ilə öz hostumuzdan,
`display: swap`; yalnız səhifənin istifadə etdiyi unicode alt-dəstləri endirilir.
**Manat işarəsi (₼) bu şriftlərdə yoxdur:** sistem şriftinə düşür; qiymətlər `tabular-nums`.
Böyük editorial başlıqlar (hero 56–120px) yalnız `font-heading`; sətir uzunluğu `max-w-prose`.

## Spacing və radius

- Spacing: Tailwind şkalası (4px addım); səhifə kənarı mobil 16px, desktop 24px; bölmələr arası 48px.
- Radius: baza `0.375rem` (`--radius`); editorial bloklar az yuvarlaq, incə xətli; nişan tam yuvarlaq.

## Motion

Xarakter: premium zərgərlik vitrinlərinin (ilham: Swarovski) sakit, yavaş və yumşaq dayanan
hərəkəti. Clean-room: onların kodu, faylları və dəqiq dəyərləri götürülmür; hiss müşahidə edilir,
dəyərlər bizimdir (`tokens.json` -> `motion`).

| Token               | Dəyər                            | Harada                                      |
| ------------------- | -------------------------------- | ------------------------------------------- |
| `--duration-fast`   | 150 ms                           | hover rəngi, fokus                          |
| `--duration-base`   | 300 ms                           | menyu, dialoq, panel                        |
| `--duration-slow`   | 600 ms                           | şəkil keçidi, link xətti, səhifə crossfade  |
| `--duration-reveal` | 800 ms                           | scroll ilə görünmə                          |
| `--duration-zoom`   | 1200 ms                          | məhsul şəklinin hover zoom-u                |
| `--duration-morph`  | 500 ms                           | kartdan məhsul səhifəsinə şəkil keçidi      |
| `--ease-luxe`       | `cubic-bezier(0.22, 1, 0.36, 1)` | əsas: sürətli başlayır, uzun yumşaq dayanır |
| `--ease-standard`   | `cubic-bezier(0.4, 0, 0.2, 1)`   | kiçik UI dəyişiklikləri                     |
| `--ease-in-out`     | `cubic-bezier(0.65, 0, 0.35, 1)` | açılıb-bağlanan panellər                    |

Naxışlar:

- **Scroll reveal:** `<Reveal index={i}>`, 24px yuxarı + fade, qrupda 80 ms növbə. Bir dəfə işləyir.
  JS olmadıqda (`@media (scripting: enabled)`) gizlənmir, crawler və AI hər şeyi görür.
- **Məhsul şəkli:** `group` + `overflow-hidden` daxilində `img-zoom` (1.05, 1200 ms) və ikinci şəkil
  üçün `img-swap` (crossfade). Yalnız `hover: hover` cihazlarda.
- **Link:** `link-underline`, xətt soldan sağa çəkilir.
- **Səhifə keçidi:** View Transitions API, bütün səhifə üçün sakit crossfade; kartdakı şəkil
  məhsul səhifəsinə `<ViewTransition name="product-{id}" share="morph" default="none">` ilə "uçur".
- **Header:** aşağı scroll-da gizlənir, yuxarı scroll-da `transform` ilə geri gəlir (1.4).

Qaydalar (Lighthouse üçün):

- Yalnız `opacity` və `transform`. `width`, `height`, `top`, `margin` animasiya olunmur (CLS = 0).
- LCP elementi və ilk ekrandakı məzmun **heç vaxt** reveal olunmur.
- `prefers-reduced-motion: reduce`-da bütün keçidlər, zoom və view transition-lar söndürülür.
- Tema keçidində animasiya yoxdur. Avtomatik oynayan video və karusel yoxdur.

## Komponentlər

shadcn/ui (`base-nova`, Base UI): Button (`gold` variantı əlavə), Badge (`gold`), Input, Label,
Card, Dialog, Sheet. Dialog və Sheet-in bağla düyməsinin adı `closeLabel` prop-u ilə ötürülür
(tərcümə üçün). İkonlar yalnız `lucide-react`, dekorativ ikonlarda `aria-hidden`.

## Hərəkət kitabxanası

Kinematik hero (3 səhnə) GSAP 3 + ScrollTrigger ilə qurulur (`gsap` npm, "Standard no charge"
lisenziyası, kommersiya istifadəsi pulsuz). Qaydalar: yalnız ana səhifədə, hero görünəndən sonra
dinamik import; LCP poster şəkildir, animasiyadan asılı deyil; `prefers-reduced-motion` olanda
pin və scrub yoxdur, statik səhnələr ardıcıl göstərilir; mətn real HTML-dir, 3 dildə.
Başqa səhifələrdə animasiya CSS ilə (`--duration-*`, `--ease-*` token-ləri).
