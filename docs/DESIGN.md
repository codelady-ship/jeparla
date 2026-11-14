# Jeparla dizayn sistemi

Mənbə: [`docs/design/tokens.json`](./design/tokens.json). Ondan `frontend/src/app/tokens.css`
generasiya olunur (`npm run tokens`). Əl ilə CSS-də rəng yazılmır; komponentlərdə raw hex yoxdur.
Canlı nümunə: `/design` səhifəsi (indekslənmir).

## Rənglər (rollar)

| Rol                       | Light                           | Dark                            | İstifadə                    |
| ------------------------- | ------------------------------- | ------------------------------- | --------------------------- |
| bg                        | `#F7F3EA` krem                  | `#0E1814`                       | səhifə fonu                 |
| surface                   | `#FFFFFF`                       | `#16251F`                       | kart, dialoq, panel         |
| surface-muted             | `#EFE8DA`                       | `#1F3129`                       | ikinci dərəcəli fon, hover  |
| border                    | `#E2D9C6`                       | `#2B3F36`                       | dekorativ xətlər            |
| input                     | `#8F8470`                       | `#6D8479`                       | forma sərhədi (3:1)         |
| text                      | `#292929`                       | `#F7F3EA`                       | əsas mətn                   |
| text-muted                | `#5E5A52`                       | `#B9B3A6`                       | köməkçi mətn                |
| primary / on-primary      | `#16251F` / `#F7F3EA`           | `#C5A15A` / `#16251F`           | əsas düymə                  |
| accent (gold) / on-accent | `#C5A15A` / `#16251F`           | eyni                            | qızılı CTA, Verified nişanı |
| accent-text (gold-text)   | `#7A5B1F`                       | `#D8B977`                       | qızılı ikon və link         |
| ring                      | `#8C6A26`                       | `#D8B977`                       | fokus halqası               |
| danger, success, warning  | `#B42318`, `#1D6A43`, `#8A5300` | `#F2857B`, `#6CC896`, `#E5B45A` | status                      |

Tailwind sinifləri: `bg-background`, `bg-card`, `bg-muted`, `bg-primary`, `bg-gold text-on-gold`,
`text-gold-text`, `text-success`, `text-warning`, `bg-destructive text-on-destructive`.

**Qızılı qaydası.** `#C5A15A` krem fonda yalnız 2.2:1 kontrast verir. Light temada qızılı yalnız
**fon** kimi (üzərində `on-gold` tünd mətn) istifadə olunur. Qızılı ikon, link, xətt üçün
`gold-text`. Qızılı heç vaxt yeganə məna daşıyıcısı deyil (ikon + mətn).

**Səhnə rəngləri (`--scene-*`, temadan asılı deyil).** Hero səhnələri öz işığını daşıyır:
`deep #0E1814`, `green #16251F`, `ivory #F7F3EA`, `ivory-muted #B9B3A6`, `gold #C5A15A`,
`gold-light #E8D39A`, `gold-deep #8C6A26`, `silver #D8DCE1`, `diamond #F7F8FA`,
`silver-text #4A4F57`. Tailwind: `bg-scene-deep`, `text-scene-gold-light` və s.

**Kontrast.** `tokens.json`-dakı `pairs` siyahısındakı 66 cüt WCAG AA-dan keçir. Yoxlama:
`python3 tools/contrast.py docs/design/tokens.json` (CI) və `npm test` (eyni düstur,
`src/lib/contrast.ts`). Yeni rəng əlavə edəndə cütünü də əlavə et.

## Tema

`next-themes`, `class` atributu, standart `system`, seçim `localStorage`-da (`jeparla-theme`).
Tema skripti HTML-dən əvvəl işləyir, yanıb-sönmə olmur. İkonlar CSS ilə (`dark:`) seçilir,
hidratasiya fərqi yoxdur. Keçid düyməsi: `ThemeToggle`. Hero səhnələri hər iki temada eynidir.

## Tipoqrafiya

| Rol                            | Şrift             | Qeyd                                    |
| ------------------------------ | ----------------- | --------------------------------------- |
| Başlıq (`font-heading`, h1–h3) | Cormorant         | variable serif (300–700), italic yoxdur |
| Mətn (`font-sans`)             | sistem sans-serif | şrift büdcəsi: səhifədə maks. 2 fayl    |
| Kiçik texniki nişanlar         | sistem monospace  | `font-mono`, az istifadə (tarix, mənbə) |

Cormorant Ə İ Ş Ç Ğ Ö Ü və rus hərflərini dəstəkləyir. Şrift `next/font` ilə öz hostumuzdan,
`display: swap`; yalnız səhifənin istifadə etdiyi unicode alt-dəstləri endirilir.
**Manat işarəsi (₼) bu şriftlərdə yoxdur:** sistem şriftinə düşür; qiymətlər `tabular-nums`.
Böyük editorial başlıqlar (hero 56–120px) yalnız `font-heading`; sətir uzunluğu `max-w-prose`.

## Spacing və radius

- Spacing: Tailwind şkalası (4px addım); səhifə kənarı mobil 16px, desktop 24px; bölmələr arası 48px.
- Radius: baza `0.5rem` (`--radius`), kart `rounded-xl`, nişan tam yuvarlaq.

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

## Məhsul şəkli standartı (#119)

Kataloq bir premium mağaza kimi görünməlidir: bütün məhsul şəkilləri eyni fonda, eyni kəsimdə və eyni işıqda.

- **Fon:** krem `--background` (`#F7F3EA`) və ya çox açıq neytral; kartın fonu ilə eyni rəng,
  şəkil kartla birləşir. Qara, yaşıl, jurnal və naxışlı fon yoxdur.
- **Kəsim:** 4:5 portret. Əşya mərkəzdə, kadrın təxminən 70%-i; zəncir və qolbaq kənara toxunmur.
- **İşıq:** yumşaq, səpələnmiş, ağ balansı neytral (fon krem görünür, boz və ya sarı yox). Əşyanın altında
  yumşaq kontakt kölgəsi, əks və rekvizit yoxdur, mətn və su nişanı yoxdur.
- **Format:** WebP (AVIF olarsa daha yaxşı), ən uzun tərəf 2000 px-dən çox deyil; LCP şəkli `priority`.
- **Dürüstlük:** "Studiya görünüşü" (AI Studio `STUDIO_LOOK`) yalnız fonu silir, mərkəzləyir və kölgə əlavə
  edir; əşyanın forması, rəngi və daşları dəyişmir, ona görə nişansız dərc olunur. Generativ dəyişiklik
  (AI fotosessiya, model üzərində) həmişə "AI ilə yaradılıb" nişanı ilə. Orijinal şəkil həmişə qalır.
- **Satıcı bələdçisi:** məhsul formasının şəkil addımında "Telefonla yaxşı şəkil: 5 addım" (işıq, fon, bucaq,
  fokus, miqyas) və hər şəkil üçün xəbərdarlıq: qısa tərəf 800 px-dən az, çox qaranlıq, bulanıq
  (`lib/merchant/photo-quality.ts`). Xəbərdarlıq bloklamır, satıcı qərar verir.
- Demo fotoların fonunun lokal silinməsi (`@imgly/background-removal-node`) və 390/1440 px-də 12 kartlıq dizayn
  review ayrıca işdir: hər demo şəkil gözlə yoxlanılır.

## Hərəkət kitabxanası

Ana səhifə hero-su Remotion-da qurulmuş səhnədir (`video/`): 1-ci akt qısa video (pələnglər gəlib dayanır,
autoplay, səssiz, loop yoxdur, son kadrda qalır), 2-ci akt scroll ilə canvas-da oynayan kadrlardır
(`src/lib/motion/frames.ts`: kadrlar kobuddan incəyə yüklənir). Pin CSS ilədir (hündür konteyner +
`position: sticky` səhnə), JS yalnız scroll mövqeyini kadra çevirir (passive listener +
requestAnimationFrame). Arxadakı böyük "Jeparla" sözü videonun içindədir (başların arxasında, kölgə kimi);
scroll başlayanda söz yox olur, modellər çıxanda isə "Jeparla" sol başlığın üstündə HTML sətri kimi
görünür (`aria-hidden`, `data-hero-brand`). Masaüstündə video aşağıdan bərkidilib, ona görə geniş
ekranlarda başlar kəsilməsin deyə heyvanlar kadr eninin 40%-ni, modellər isə kadr hündürlüyünün
66%-ni tutur. Modellər dizdən yuxarı çəkilib, kadrın alt kənarı ilə kəsilir və bir-birinə yaxın,
çiyin-çiyinə dayanır; ortadakı öndədir (`video/src/layout.ts`).
Səhifə eni: `container-page` (maks. 90rem, axıcı kənar boşluğu `--gutter-page`). Fonun rəngi
videodan oxunur (`--hero-bg`), səhifə və video bir krem olur. GSAP sınandı, amma 250 KB skript
büdcəsinə sığmadı (2026-11-04). Qaydalar: LCP başlıq/söz mətnidir, video poster yoxdur; kadrlar
1-ci aktdan sonra yüklənir; `prefers-reduced-motion` olanda pin və autoplay yoxdur, son kadr
(üç model) göstərilir; mətn real HTML-dir, 3 dildə, bir şüar.
Başqa səhifələrdə animasiya CSS ilə (`--duration-*`, `--ease-*` token-ləri).
