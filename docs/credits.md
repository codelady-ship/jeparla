# Şəkil və video mənbələri

Saytdakı üçüncü tərəf və yaradılmış vizualların mənbəyi. Yeni şəkil və ya video əlavə edəndə
buraya yazın.

## Ana səhifə hero (`frontend/public/hero/`)

Səhnə: ağ pələng, qızılı pələng və qara bəbir (pantera) gəlib mərkəzdə dayanır, qızılı işıq keçir və onlar gümüş,
qızıl və brilyant zərgərlik taxmış üç modelə çevrilir.

- **Gəliş (1-ci akt):** AI video (Higgsfield, Kling 2.5 Turbo, 720p, 5 san., 2026-11-08):
  `video/source/walk.mp4` (başlanğıc kadr `video/source/walk-start.jpg`). Hər kadrın fonu lokal olaraq
  silinib (`@imgly/background-removal-node`), kadrlar `video/public/walk/NNN.webp`-dir və Remotion-da
  sayt kremi üzərində oynayır. Pələnglər (2-ci akt) klipin son kadrından kəsilib (`video/public/tiger-N.png`).
- **Modellər:** AI ilə yaradılıb (Vheer, "Text to Image", 2026-11-08), hər biri ayrıca dizdən yuxarı
  portret, zinət əşyası önə çəkilmiş pozada (mənbələr `video/source/models/m0..2.jpg`);
  fonları lokal olaraq silinib, `video/public/model-N.png`. Köhnə mənbələr (`tigers.jpg`, `models.jpg`)
  arxiv kimi `video/source/`-da qalır.
- **Kompozisiya:** Remotion layihəsi (`video/`). `cd video && sh scripts/export.sh`
  `enter-*.mp4` (1-ci akt) və `tf-*/NN.jpg` (2-ci akt, scroll ilə) fayllarını yaradır.
- **İşarələmə:** sahibin qərarı ilə (2026-11-05) hero-da "AI" yazısı göstərilmir. Bu, kampaniya
  vizualıdır, məhsul şəkli deyil: modellərin taxdığı zərgərlik kataloqdakı konkret məhsulu
  təsvir etmir. Məhsul şəkilləri üçün AI işarəsi qaydası (`CLAUDE.md`) qüvvədədir.
- Modellər real insan deyil; sahibin öz çəkilişi (model razılığı ilə) gələndə dəyişdirilə bilər.

## Köhnə hero (silinib, 2026-11-08)

Unsplash fotoları (Tommaso Ubezio, Wildlife by Irina, Lambert Huang) artıq istifadə olunmur.

## Demo kataloq şəkilləri (`frontend/public/demo/`)

Backend gələnə qədər nümunə məhsulların (`src/lib/api/mock/fixtures.ts`) şəkilləridir. Hamısı
[Unsplash Lisenziyası](https://unsplash.com/license) ilə pulsuzdur (Unsplash+ deyil), 800x1000
kəsilib (2026-11-09). Real fotodur, AI deyil, amma kataloqdakı nümunə məhsulun özünü göstərmir:
məhsul təsviri "nümunə məhsul, real deyil" deyir. Real mağaza şəkilləri gələndə silinəcək.

| Fayl | Müəllif | Mənbə |
|---|---|---|
| `ring-gold-1.jpg` | JESUS ECA | https://unsplash.com/photos/wewzzx11ShI |
| `ring-silver-1.jpg` | César O'neill | https://unsplash.com/photos/BdavhWCihfw |
| `ring-silver-3.jpg` | Salvador Escalante | https://unsplash.com/photos/bj60QB8xBl8 |
| `earrings-gold-1.jpg` | Diego Castañeda | https://unsplash.com/photos/q4uRpPcvF88 |
| `earrings-gold-2.jpg` | Oscar Ramirez | https://unsplash.com/photos/77vl4dH6KKQ |
| `earrings-gold-3.jpg` | JESUS ECA | https://unsplash.com/photos/DRbPrVTyTyA |
| `earrings-silver-1.jpg` | César O'neill | https://unsplash.com/photos/uvK9BqN_pvY |
| `necklace-gold-1.jpg` | Paul Lora | https://unsplash.com/photos/HiGJ04wtX4w |
| `necklace-gold-2.jpg` | Andrey Ilkevich | https://unsplash.com/photos/0ziihuUXMcs |
| `necklace-gold-3.jpg` | Andrey Ilkevich | https://unsplash.com/photos/L-rNkUK2SZU |
| `necklace-silver-1.jpg` | Sabrianna | https://unsplash.com/photos/u1Hv_erOQH0 |
| `necklace-silver-2.jpg` | Hanna Balan | https://unsplash.com/photos/diLY227UOvg |
| `necklace-silver-3.jpg` | Chiara Monti | https://unsplash.com/photos/rnxMMjscvdc |
| `bracelet-gold-2.jpg` | Diego Castañeda | https://unsplash.com/photos/Jno26Xf1-WI |
| `bracelet-gold-3.jpg` | Diego Castañeda | https://unsplash.com/photos/y7xmVsIXNUI |
| `bracelet-silver-1.jpg` | César O'neill | https://unsplash.com/photos/St60rvtQJpM |

## AI model kitabxanası (#130)

Model üzərində şəkillər üçün AI modellər (real şəxs deyil). Hər model admin paneldə yüklənir və burada
qeyd olunur: ad, auditoriya, dəri tonu, üslub, yaradıldığı alət və tarix (API-dəki `origin` sahəsi ilə eyni).
Modellər pullu generasiya ilə yaradıldığı üçün xərc sahibin təsdiqi ilə.

| Model | Auditoriya | Dəri tonu | Üslub | Mənşə (alət, tarix) |
| --- | --- | --- | --- | --- |
| (hələ model yoxdur) | | | | |
