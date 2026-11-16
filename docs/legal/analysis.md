> **Hüquqşünas olmayan tərəfindən hazırlanmış qaralama analizi.** Bu sənəd hüquqi məsləhət deyil. Saytdakı
> hüquqi mətnlər sahibin qərarı ilə (2026-11-16) bu analiz əsasında yekunlaşdırılıb və dərc olunub. Komissiya
> ilə işə başlamazdan əvvəl Azərbaycan Respublikasında lisenziyalı hüquqşünasın yoxlaması tövsiyə olunur
> (bölmə 8).

# Jeparla: hüquqi mövqe, öhdəliklər, risklər və tövsiyələr

Tarix: 2026-11-16. Əlaqəli issue-lar: #57 (hüquqi tələblər), #138 (bəyanat və saxlama), #107 (satıcı kodeksi), #56 (hüquqi səhifələr). Əvvəlki araşdırma: [sellers-liability.md](./sellers-liability.md).

Saytdakı mətnlər: `/legal/privacy`, `/legal/terms`, `/legal/sellers`, `/legal/cookies` (az, en, ru; `frontend/src/content/legal/*.json`). Tarix: `frontend/src/content/legal/types.ts`, `LEGAL_UPDATED`.

## 1. Mənbələr

| Qısa ad | Akt | URL | Status |
|---|---|---|---|
| FMQ | "Fərdi məlumatlar haqqında" Qanun, 11.05.2010, № 998-IIIQ, 28.06.2024 tarixli 1193-VIQD Qanununadək | https://afsa.gov.az/storage/pages/10690/ferdi-melumatlar-haqqinda-azerbaycan-respublikasinin-qanunu.pdf | Tam oxundu: maddə 2, 5, 7-17. 2024-dən sonrakı dəyişikliklər yoxlanılmayıb |
| İHMQ | "İstehlakçıların hüquqlarının müdafiəsi haqqında" Qanun, 2023-cü ilədək dəyişikliklərlə | https://faolex.fao.org/docs/pdf/aze68014.pdf | Oxundu: maddə 1, 3, 13-16. Sonrakı dəyişikliklər yoxlanılmayıb |
| CM | Cinayət Məcəlləsi, maddə 15 və 75 | https://www.wipo.int/wipolex/edocs/lexdocs/laws/az/az/az123az_1.pdf (rəsmi olmayan ingilis tərcüməsi) | 15 və 75.1 oxundu: kiçik ictimai təhlükəli - 2 il; az ağır - 7 il; ağır - 12 il |
| ET | "Elektron ticarət haqqında" Qanun, 2005 | https://www.wipo.int/wipolex/en/text/219826 | 5.3, 5.5, 12.4-12.6 (sellers-liability.md) |
| QMQD | "Qiymətli metallar və qiymətli daşlar haqqında" Qanun | sellers-liability.md | 9.3, 10.3, 11.4 |
| İXM | İnzibati Xətalar Məcəlləsi | https://www.wipo.int/wipolex/en/legislation/details/22835 | 375, 428, 453, 457-459 |

Oxunmayan aktlar (mətnlərdə maddə nömrəsi ilə istinad edilmir): Mülki Məcəllə, "Reklam haqqında" Qanun, informasiya qanunu, Vergi Məcəlləsi, FMQ 15 reyestr qaydaları və 15.3.3 istisnaları, 9.14 lisenziya qaydası, əyar nəzarəti qurumunun adı.

## 2. Hüquqi mövqe

- Kataloq / informasiya platforması: satış, ödəniş, çatdırılma platformadan keçmir; Jeparla alqı-satqı müqaviləsinin tərəfi deyil.
- Məlumat saxlayan vasitəçi (ET 12.4): xəbər tutduqda qanunsuz məlumatı dərhal silir; şikayət və silmə proseduru şərtlərdə və kodda var.
- Fərdi məlumatların mülkiyyətçisi və operatoru (FMQ 2.1.9, 10); WhatsApp yazışmasını mağaza ayrıca operator kimi emal edir.
- Hazırda satıcıdan ödəniş alınmır; komissiya başlayanda müqavilə, vergi qeydiyyatı və bu analizin yenilənməsi lazımdır.

## 3. Öhdəliklər

| Öhdəlik | Mənbə | Necə |
|---|---|---|
| Toplama zamanı məlumatlandırma | FMQ 11.2 | Məxfilik siyasəti, qeydiyyat bildirişi, bəyanatda IP cümləsi |
| Razılıq / subyektin təqdim etdiyi məlumat | FMQ 8.1, 9.6.1 | Formada təqdim; qeydiyyatda qəbul (risk 1) |
| Minimallaşdırma, məqsəd bitəndə məhv | FMQ 9.2, 9.4 | Bölmə 5; bəyanat psevdonimləşdirməsi (#138) |
| Hüquqlar; 7 iş günü (+7), rədd 5 iş günü | FMQ 7, 12 | Siyasət "Sizin hüquqlarınız" |
| Təhlükəsizlik, audit jurnalı | FMQ 5.8, 9.12 | HTTPS, BCrypt, məxfi bucket, minimal DB rolu, dəyişməz audit, şifrəli backup |
| Transsərhəd ötürmə | FMQ 14.2.2, 14.3 | Server Almaniyada; siyasətdə və qeydiyyat bildirişində razılıq |
| İnformasiya sisteminin qeydiyyatı | FMQ 15 | Edilməyib, sahib yoxlatmalıdır |
| Satıcı identifikasiyası | ET 5.3 | Satıcı şərtlərində öhdəlik; VÖEN mağaza səhifəsində hələ yoxdur |
| Silmə, orqanla əməkdaşlıq | ET 5.5, 12.4, 12.6; İXM 459 | Şərtlər, satıcı şərtləri, legal hold |
| İstehlakçı hüquqlarını məhdudlaşdıran şərt etibarsızdır | İHMQ 16 | Ayrıca bölmə; qəsd/kobud ehtiyatsızlıq istisna edilmir |
| Damğasız qiymətli metal satılmır | QMQD 10.3 | Kodeks, satıcı şərtləri, bəyanat |

## 4. Risklər

1. Razılığın forması (FMQ 8.1, 8.2, 8.6 EHİS): veb bildiriş kifayət etməyə bilər. Hüquqşünas sualı № 1.
2. İnformasiya sisteminin qeydiyyatı və lisenziya (FMQ 15.2, 9.14; İXM 375).
3. Əvvəlcədən sənəd yoxlaması "ümumi monitorinq" sayıla bilərmi (ET 12.5).
4. Satıcı şərtlərinin qəbulu: kodeks və şərtlərin versiyası ayrıca saxlanılır (V58, `seller_terms_versions`); kodeks v2 (istehlakçı hüquqları bəndi) ilə hamıdan yenidən qəbul tələb olunur, versiya dəyişəndə də.
5. Bəyanatda "Cinayət Məcəlləsi" ifadəsi: özəl sertifikat üçün ehtimal formasında; mətn dəyişdirilmədi.
6. Saxlama müddətləri gündəlik job ilə icra olunur (#249); job dayanarsa (məs. `JEPARLA_RETENTION_CRON=-`), silmə gecikir.
7. Hesab silinəndə bəyanatdakı ad 7 il qalır (FMQ 7.1.5 istisnası): hüquqşünas təsdiqləməlidir.
8. Komissiya modelinin vergi tərəfi araşdırılmayıb.

## 5. Saxlama müddətləri

| Məlumat | Müddət | İcra |
|---|---|---|
| Hesab, bildirişlər, məktub növbəsi | Hesab silinənə qədər | ON DELETE CASCADE |
| Sessiya / yeniləmə / ailə | 7 gün / 30 gün / 90 gün | Avtomatik |
| Sui-istifadə sayğacları | ≤ 30 gün | Redis TTL |
| Şifrəli backup | 14 gün | Bucket lifecycle (sahib) |
| Təsdiqlənmiş sənədlər | Əməkdaşlıqdan sonra 3 il | `RetentionJob` (gündəlik), fayl da silinir |
| Rədd edilmiş adi sənəd | 90 gün | `RetentionJob`; `AUTHENTICITY` və dayandırma sorğusundakı sənəd qalır |
| Şübhəli sənəd və sübut | Legal hold | `stores.legal_hold_at` (V56) |
| Bəyanat mətni | Silinmir | V15, V16 |
| Bəyanatın IP-si və etiketi, eyni yükləmənin audit sətirləri | 7 il, sonra psevdonim | `DeclarationRetentionJob`, V56 |
| Audit jurnalı | 7 il | `RetentionJob` -> `jeparla_purge_audit_logs` (V57); bəyanat sətirləri psevdonimlə qalır |
| Şikayətlər | Qərardan 3 il; hesab silinəndə əlaqə dərhal | ON DELETE SET NULL; `RetentionJob` |

Legal hold (`stores.legal_hold_at`) olan mağazanın sənədi, şikayəti və audit sətri heç bir müddətlə silinmir.

N = 7 il: CM 15 və 75.1 üzrə az ağır cinayətlərin müddəti; CM 320.2 və 200 üçün 2 il, CM 178.2 (5 000-50 000 AZN) üçün 7 il. Qəbul edilən risk: CM 178.3 (12 il), legal hold və açarlı heş ilə azaldılır. Dəyişmək üçün `JEPARLA_DECLARATION_RETENTION_YEARS` (7-dən az ola bilməz). Saymanın başlanğıcı: bəyanat, mağazanın son bəyanatı və mağazanın APPROVED-dan çıxması; hamısı N ildən köhnə olmalıdır.

## 6. Mətn qərarları

Cookie banneri yoxdur (yalnız zəruri cookie). Yaş həddi 18 (FMQ 8.3). Tətbiq olunan hüquq: Azərbaycan; əvvəl danışıq, sonra qanunla aidiyyət üzrə məhkəmə. Şikayət/silmə proseduru, cavab müddəti rəqəmlə vəd olunmur. Məsuliyyət yalnız qanuni həddə məhdudlaşdırılır. "100% zəmanət" yoxdur. Bəyanat mətni eyni, IP cümləsi əlavə, versiya `precious-2026-11-16`. Rədd bildirişi: "razı deyilsinizsə, dəstəyə yazın". Operator rekvizitləri konfiqurasiyadan. Noindex və banner götürüldü.

## 7. Sahibin dolduracağı sahələr

`JEPARLA_OPERATOR_NAME`, `JEPARLA_OPERATOR_TAX_ID` (10 rəqəm), `JEPARLA_OPERATOR_ADDRESS`, `JEPARLA_SUPPORT_EMAIL`/`_URL`, `JEPARLA_PSEUDONYM_KEY` (surəti parol menecerində), e-poçt provayderinin adı (siyasətin `sharing` bölməsi, `LEGAL_UPDATED` yenilənir). Dəyərlər dəyişəndə `web` yenidən build olunur.

## 8. Lisenziyalı hüquqşünas üçün suallar (komissiyadan əvvəl)

1. FMQ 8.1, 8.2, 8.6: veb razılıq kifayətdirmi, EHİS tələb olunurmu?
2. FMQ 15 və 9.14: qeydiyyat və lisenziya lazımdırmı?
3. Transsərhəd ötürmə (Almaniya, Cloudflare R2): adekvatlıq və razılığın forması.
4. ET 12.5: könüllü sənəd yoxlaması "ümumi monitorinq" sayılırmı?
5. Müddətlər: N = 7, sənədlər 3 il, şikayətlər 3 il; hesab silindikdə bəyanatdakı adın saxlanması.
6. Komissiya müqaviləsi, vergi rejimi, satıcı şərtlərinin qəbulunun forması.

## 9. Açıq texniki işlər

Saxlama müddətlərinin avtomatlaşdırılması (sənədlər, şikayətlər, audit purge cron), hesabın özü tərəfindən silinməsi, mağaza səhifəsində satıcı rekvizitləri (ET 5.3), admin paneldə legal hold düyməsi, satıcı kodeksi v2 (istehlakçı hüquqları bəndi və satıcı şərtlərinin qəbulu).
