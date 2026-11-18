# Jeparla ikonları

Issue #50. İkonlar yalnız [`lucide-react`](https://lucide.dev) (ISC lisenziyası) ilə; öz ikon
kitabxanamız yoxdur və yaradılmır. Emoji ikon kimi işlənmir. Bu cədvəl hər əsas anlayış üçün
bir ikon təyin edir ki, eyni məna saytın hər yerində eyni ikonla görünsün.

Vəziyyət: `main`, 2026-11-18, `frontend/src` üzrə `lucide-react` importları.

## Qaydalar

- Bir anlayış, bir ikon. Yeni ekran əvvəl bu cədvələ baxır; anlayış yoxdursa, cədvələ əlavə edilir.
- Ölçü: mətnin yanında `size-4` (16 px), düymədə `size-5` (20 px), boş vəziyyətdə `size-10`.
  Xətt qalınlığı standart (2), dəyişdirilmir.
- Rəng: `currentColor`. Qızılı ikon light temada `text-gold-text`, heç vaxt `#C5A15A` (kontrast).
- Dekorativ ikon `aria-hidden`; tək ikonlu düymədə `aria-label` (3 dildə, `messages/`).
- İkon heç vaxt mənanın yeganə daşıyıcısı deyil: yanında mətn və ya `aria-label` olur.
- Loqo və favicon ikon deyil: onlar [`logo-options.html`](./logo-options.html)-dən seçilən variantdır.

## Anlayış cədvəli

| Anlayış                              | İkon                | Harada işlənir (nümunə)                                          |
| ------------------------------------ | ------------------- | ---------------------------------------------------------------- |
| Axtarış                              | `Search`            | `search/search-dialog.tsx`, `stores/store-list.tsx`              |
| Şəkillə axtarış                      | `Camera`            | `search/search-dialog.tsx`, `search/image-search-panel.tsx`      |
| Seçilmişlər (saxla)                  | `Heart`             | `layout/site-header.tsx`, `product/product-actions.tsx`          |
| Müqayisə                             | `GitCompareArrows`  | `saved/compare-tray.tsx`, `pdp/variant-panel.tsx`                |
| WhatsApp ilə yaz                     | `MessageCircle`     | `stores/[slug]/page.tsx`, `pdp/variant-panel.tsx`                |
| Mağaza                               | `Store`             | `stores/store-list.tsx`, `merchant/merchant-nav.tsx`             |
| Ünvan                                | `MapPin`            | `stores/store-card.tsx`, `merchant/profile-form.tsx`             |
| Xəritədə aç                          | `MapIcon` (`Map`)   | `stores/store-card.tsx`                                          |
| Yaxınımda                            | `LocateFixed`       | `stores/near-me-button.tsx`                                      |
| Telefon                              | `Phone`             | `stores/[slug]/page.tsx`                                         |
| İş saatı                             | `Clock`             | `pdp/store-open-status.tsx`                                      |
| Yoxlanılmış (mağaza, məhsul nişanı)  | `BadgeCheck`        | `home/home-sections.tsx`, `verified/page.tsx`                    |
| Sənəd yoxlanılıb                     | `FileCheck2`        | `stores/[slug]/page.tsx`, `merchant/code-banner.tsx`             |
| Ekspertiza / laboratoriya            | `Microscope`        | `verified/page.tsx`, `home/home-sections.tsx`                    |
| Əyar damğası                         | `Stamp`             | `stores/store-facts.tsx`, `merchant/evidence-upload.tsx`         |
| Daş, brilyant, kateqoriya            | `Gem`               | `categories/category-tiles.tsx`, `stores/store-facts.tsx`        |
| Bijuteriya                           | `Shapes`            | `product/product-card.tsx`                                       |
| AI ilə yaradılmış şəkil              | `Sparkles`          | `product/product-card.tsx`, `merchant/ai-studio.tsx`             |
| Metal qiyməti, AMB məzənnəsi         | `Landmark`          | `metal/metal-price-widget.tsx`                                   |
| Qiymət hesabı                        | `Calculator`        | `pdp/price-breakdown.tsx`                                        |
| Qiymət qalxdı / düşdü                | `TrendingUp` / `TrendingDown` | `saved/price-changes.tsx`                              |
| Metala bağlı qiymət (satıcı)         | `Coins`             | `merchant/product-table.tsx`, `admin/page.tsx`                   |
| Çəki                                 | `Scale`             | `stores/store-facts.tsx`                                         |
| Ölçü                                 | `Ruler`             | `size-guide/page.tsx`, `stores/store-terms.tsx`                  |
| Çatdırılma / qaytarma / hədiyyə / təmir | `Truck` / `Undo2` / `Gift` / `Hammer` | `stores/store-terms.tsx`                          |
| Şikayət et                           | `Flag`              | `pdp/report-dialog.tsx`, `admin/page.tsx`                        |
| Paylaş                               | `Share2`            | `merchant/merchant-nav.tsx`                                      |
| Paylaş (iOS sistem vərəqi)           | `Share`             | `share/share-button.tsx`, `pwa/install-prompt.tsx`               |
| Nümunə məlumat                       | `FlaskConical`      | `layout/sample-data-banner.tsx`                                  |
| Dil                                  | `Languages`         | `i18n/locale-switcher.tsx`                                       |
| Tema                                 | `Sun` / `Moon`      | `theme/theme-toggle.tsx`                                         |
| Menyu                                | `Menu`              | `layout/mobile-nav.tsx`                                          |
| Hesab                                | `UserRound`         | `auth/signed-in-menu.tsx`                                        |
| Bildirişlər                          | `Bell`              | `merchant/merchant-nav.tsx`                                      |
| Şəkil yüklə / əlavə et               | `Upload` / `ImagePlus` | `merchant/image-upload.tsx`, `search/image-search-panel.tsx`  |
| Redaktə et                           | `Pencil`            | `merchant/product-table.tsx`, `admin/ai-model-list.tsx`          |
| Sil                                  | `Trash2`            | `merchant/draft-delete-button.tsx`, `auth/delete-account.tsx`    |
| Bağla                                | `X`                 | `saved/compare-view.tsx`, `search/search-dialog.tsx`             |
| Yüklənir                             | `Loader2`           | `auth/auth-form.tsx` və 18 başqa fayl                            |
| Uğur                                 | `CircleCheck`       | `auth/recovery.tsx`, `sell/seller-done.tsx`                      |
| Xəbərdarlıq                          | `TriangleAlert`     | `admin/users-list.tsx`, `merchant/image-upload.tsx`              |
| Xəta                                 | `CircleAlert`       | `auth/recovery.tsx`, `calculator/metal-calculator.tsx`           |
| Məlumat                              | `Info`              | `size-guide/page.tsx`                                            |
| Xarici keçid                         | `ExternalLink`      | `pdp/price-breakdown.tsx`, `admin/verification-list.tsx`         |
| İrəli / geri                         | `ArrowRight` / `ArrowLeft` | `home/home-sections.tsx`, `sell/seller-wizard.tsx`        |

## Uyğunsuzluqlar (ayrıca kiçik `fix` PR-ı ilə düzəldilir)

Bu PR kodu dəyişmir. Tapılan fərqlər:

| Anlayış        | İndi                                                                                   | Olmalı             |
| -------------- | -------------------------------------------------------------------------------------- | ------------------ |
| Yoxlanılmış    | `ShieldCheck`: `product/product-card.tsx`, `stores/store-card.tsx`, `admin/page.tsx`, `admin/verification-list.tsx`; `BadgeCheck`: `home/home-sections.tsx`, `verified/page.tsx` | Alıcıya görünən nişan `BadgeCheck`; admin yoxlama bölməsi `ShieldCheck` qala bilər (fərqli anlayış: yoxlama prosesi) |
| Uğur           | `CheckCircle2`: `merchant/product-form.tsx`                                            | `CircleCheck`      |
| Xəbərdarlıq    | `AlertTriangle`: `merchant/merchant-shell.tsx`                                         | `TriangleAlert`    |
| Xəta           | `AlertCircle`: `merchant/draft-quick-edit.tsx`                                         | `CircleAlert`      |
| Yüklənir       | `LoaderCircle`: `stores/near-me-button.tsx`                                            | `Loader2`          |
| Redaktə et     | `PencilLine`: `admin/metal-prices.tsx`; `PenLine`: `stores/store-terms.tsx` (fərdi sifariş, ayrı anlayış) | `Pencil` (redaktə üçün) |
| Sənəd          | `FileCheck`: `merchant/merchant-nav.tsx`, `stores/store-facts.tsx`; `FileCheck2` başqa yerlərdə | `FileCheck2`  |

`AlertTriangle`, `AlertCircle`, `CheckCircle2` lucide-də köhnə adlardır (alias); yeni adlar
`TriangleAlert`, `CircleAlert`, `CircleCheck`. `ui/dialog.tsx` və `ui/sheet.tsx`-dəki `XIcon`
shadcn/ui generatorundan gəlir, `X` ilə eyni ikondur, toxunulmur.
