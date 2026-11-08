# Şəkil və video mənbələri

Saytdakı üçüncü tərəf və yaradılmış vizualların mənbəyi. Yeni şəkil və ya video əlavə edəndə
buraya yazın.

## Ana səhifə hero (`frontend/public/hero/`)

Səhnə: ağ pələng, qızılı pələng və qara bəbir (pantera) gəlib mərkəzdə dayanır, qızılı işıq keçir və onlar gümüş,
qızıl və brilyant zərgərlik taxmış üç modelə çevrilir.

- **Mənbə şəkillər:** AI ilə yaradılıb (Vheer, "Text to Image"; modellər 2026-11-05, heyvanlar 2026-11-08):
  `video/source/tigers.jpg` və `video/source/models.jpg`. Fonları lokal olaraq silinib
  (`@imgly/background-removal-node`), fiqurlar `video/public/` qovluğundadır.
- **Hərəkət:** Remotion layihəsi (`video/`), AI video deyil. `cd video && sh scripts/export.sh`
  `enter-*.mp4` (1-ci akt) və `tf-*/NN.jpg` (2-ci akt, scroll ilə) fayllarını yaradır.
- **İşarələmə:** sahibin qərarı ilə (2026-11-05) hero-da "AI" yazısı göstərilmir. Bu, kampaniya
  vizualıdır, məhsul şəkli deyil: modellərin taxdığı zərgərlik kataloqdakı konkret məhsulu
  təsvir etmir. Məhsul şəkilləri üçün AI işarəsi qaydası (`CLAUDE.md`) qüvvədədir.
- Modellər real insan deyil; sahibin öz çəkilişi (model razılığı ilə) gələndə dəyişdirilə bilər.

## Köhnə hero (silinib, 2026-11-08)

Unsplash fotoları (Tommaso Ubezio, Wildlife by Irina, Lambert Huang) artıq istifadə olunmur.
