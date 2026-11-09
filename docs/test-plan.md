# Test planı: frontend E2E və əlçatanlıq

Avtomatik testlər `frontend/e2e/`-dədir (Playwright + `@axe-core/playwright`). Hər test iki
ölçüdə işləyir: telefon (390px) və masaüstü (1440px). Selektorlar yalnız rol və label ilədir
(`getByRole`, `getByLabel`), ona görə testlər eyni zamanda əlçatanlıq adlarını da yoxlayır.

Hər testdə ümumi qayda (`e2e/fixtures.ts`): konsolda xəta, tutulmamış JS xətası və ya 5xx cavab
olarsa test uğursuz olur. axe yoxlaması WCAG 2.1 A/AA qaydaları ilə 0 pozuntu tələb edir.

Lokal işə salmaq (`frontend/`-dən):

```
npm run build
npm run e2e
```

CI-da `frontend` workflow-unun `e2e and axe` işi eyni əmrləri işlədir; uğursuz olanda trace-lər
artefakt kimi yüklənir.

## Axınlar

| Axın | Happy path | Edge hallar | Negativ hallar | Fayl |
|---|---|---|---|---|
| Kataloq filtr -> PDP -> WhatsApp | Metal = Gümüş, nəticə sayı dəyişir, kartlarda yalnız gümüş; məhsula keçid; WhatsApp linki `wa.me/994...` və mesajda məhsulun adı (Azərbaycan hərfləri ilə) | Telefonda filtr panel (sheet) içindədir; geri düyməsi filtrli siyahıya qaytarır | Heç nə tapılmayan filtr boş vəziyyət göstərir; olmayan məhsul 404 | `catalog.spec.ts` |
| Axtarış (mağaza, kateqoriya) | "Ayzər" mağazanı tapır, nəticə növləri sayları, mağaza səhifəsinə keçid | "sırğa" kateqoriya tapır; 300 simvolluq "ş" sorğusu səhifəni sındırmır, yana sürüşmə yoxdur | Boş sorğu təklifləri göstərir | `search.spec.ts` |
| Dil və tema | az -> en keçidi eyni səhifədə qalır, `lang` dəyişir; ru səhifəsi kiril başlıq | İkiqat klik temanı pozmur; tema yeniləmədən sonra yadda qalır | | `locale-theme.spec.ts` |
| Satıcı qeydiyyat sihirbazı | 4 addım: hesab, mağaza (Azərbaycan hərfləri ilə ad), sənəd (PDF, adı Azərbaycan hərfləri ilə), məhsulsuz bitirmə | "Geri" daxil edilən məlumatı saxlayır | Qısa şifrə addımı saxlayır və sahəni `aria-invalid` edir; `?step=4` linki addımları keçə bilmir | `seller.spec.ts` |
| Seçilmişlər və müqayisə | Məhsulu seçilmişlərə əlavə et, siyahıda görünür, sil | Yeniləmədən sonra qalır; müqayisədə 5-ci məhsul əlavə olunmur (maks. 4) | Birini çıxarmaq, hamısını təmizləmək | `saved.spec.ts` |

axe yoxlanılan səhifələr: ana səhifə (işıqlı və tünd tema), kataloq, məhsul, axtarış nəticələri,
satıcı sihirbazı, seçilmişlər, müqayisə.

## Hələ əhatə olunmayanlar

- Admin və satıcı kabineti axınları (giriş tələb edir): backend gələndə əlavə olunacaq.
- Footer-dəki `/prices` və `/legal/*` keçidləri hələ 404-dür (#43, #56); həmin səhifələr gələndə
  keçid yoxlaması əlavə olunacaq.
- Real WhatsApp açılışı yoxlanılmır, yalnız link formatı.
- Olmayan məhsulun HTTP 404 statusu: səhifə axınla gəldiyi üçün bəzən 200 qaytarır (soft 404, #93).
  Status testi `test.fixme`-dir; 404 səhifəsinin məzmunu və `noindex` yoxlanılır.
