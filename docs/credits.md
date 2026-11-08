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
- **Modellər:** AI ilə yaradılıb (Vheer, "Text to Image", 2026-11-08), hər biri ayrıca tam boy çəkiliş;
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
