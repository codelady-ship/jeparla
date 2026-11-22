# Jeparla brendi (issue #50)

| Fayl                                       | Nədir                                                        |
| ------------------------------------------ | ------------------------------------------------------------ |
| [`logo-options.html`](./logo-options.html) | Üç loqo variantının müqayisə səhifəsi (brauzerdə açılır)     |
| `png/logo-compare.png`                     | Üç variant yan-yana: krem və yaşıl fonda, 16/32/48 px nişan  |
| `png/logo-{a,b,c}-large.png`               | Hər variant böyük ölçüdə, krem və yaşıl fonda                |
| `png/logo-{a,b,c}-favicons.png`            | Nişan 16, 32, 48 px və brauzer tabında                       |
| `png/logo-{a,b,c}-header.png`              | Saytın başlığında, 390 px və 1440 px, light və dark          |
| `logo/{a,b,c}-{wordmark,mark,lockup}-{light,dark}.svg` | Mənbə SVG-lər (light: krem fon üçün, dark: yaşıl fon üçün) |
| [`voice.md`](./voice.md)                   | Brend səsi, söz siyahıları, nümunə mətnlər (az, en, ru)      |
| [`icons.md`](./icons.md)                   | `lucide-react` ikonlarının anlayış cədvəli                   |
| `src/*.mjs`                                | SVG, HTML və PNG generatorları                               |

**Hazırkı loqo (2026-11-22): əl yazısı söz-nişan.** Sahib dörd yeni qaralamadan "C"-ni seçdi: Great Vibes
şrifti ilə "Jeparla", "J"-nin başına taxılmış üzük (halqanın arxa yarısı hərfin arxasında, ön yarısı və daşı
öndədir). Generator: `src/build-logo-script.mjs`; çıxışlar: `logo/script-*.svg`,
`frontend/src/components/brand/logo-paths.ts`, `frontend/src/app/icon.svg` (sonra `npm run icons`).
Şrift: Great Vibes (Copyright 2010 The Great Vibes Pro Project Authors, SIL Open Font License 1.1); hərflər
konturlanıb, şrift faylı repoda saxlanılmır və saytda yüklənmir.

**Əvvəlki seçim (2026-11-18): variant A "Baget".** Sahib A-nı seçdi; o, saytın başlığına və footer-ə
(`frontend/src/components/brand/wordmark.tsx`), favicon-a (`icon.svg`, `favicon.ico`), iOS və PWA
ikonlarına (`npm run icons`), `/logo.png`-ə və mağaza link önizləməsinə köçürülüb. B və C seçimin
qeydi kimi burada qalır. `build-logos.mjs` A-nın path-larını `frontend/src/components/brand/logo-paths.ts`-ə
da yazır (rəngsiz; rəng token-lərdən).

## Variantlar

- **A. Baget:** serif söz-nişan, "l" hərfi şaquli baget kəsimli daşdır (iki qızılı tərəf).
- **B. Pilləli kəsim:** küncləri pilləli kəsilmiş həndəsi "J" səkkizbucaqlı çərçivədə,
  geniş aralıqlı böyük hərflərlə söz-nişan.
- **C. Damğa:** kiçik hərflərlə "jeparla", "j"-nin nöqtəsi əyar damğası formasındadır.

Hər üçü orijinaldır: heç bir real brendin loqosu, monoqramı və ya imza rəngi götürülməyib;
rənglər yalnız [`tokens.json`](../design/tokens.json) palitrasındandır.

## Şrift və lisenziya

Hərflər **Cormorant** şriftindən konturlanıb (Copyright 2015 the Cormorant Project Authors,
SIL Open Font License 1.1, Reserved Font Name yoxdur). OFL şriftlə yaradılan işə, o cümlədən
konturlanmış hərflərdən ibarət loqoya məhdudiyyət qoymur; şrift faylı repoda saxlanılmır və
paylanmır. Ölçü: A 560, B 480, C 600 (`wght` oxu), nişanlarda 620-700.

## Yenidən qurmaq

```bash
# fontkit layihənin asılılığı deyil: müvəqqəti qovluğa qurulur
npm i fontkit@2.0.4 --prefix /tmp/fk
curl -L -o /tmp/fk/Cormorant.ttf "https://github.com/google/fonts/raw/main/ofl/cormorant/Cormorant%5Bwght%5D.ttf"
FONTKIT_DIR=/tmp/fk node docs/brand/src/build-logos.mjs /tmp/fk/Cormorant.ttf
node docs/brand/src/build-sheet.mjs
FRONTEND_DIR=frontend node docs/brand/src/render-png.mjs   # Playwright və sharp frontend-dən
```
