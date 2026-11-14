import type { LegalContent } from "./types";

export const az: LegalContent = {
  privacy: {
    title: "Məxfilik siyasəti",
    description:
      "Jeparla hansı məlumatları saxlayır, nə üçün və hansı xidmət provayderləri ilə işləyir.",
    sections: [
      {
        heading: "Məlumatları kim emal edir",
        review:
          "Operatorun hüquqi adı, VÖEN, ünvanı və əlaqə e-poçtu. Fərdi məlumatlar üzrə məsul şəxs (əgər tələb olunursa).",
      },
      {
        heading: "Hansı məlumatlar saxlanılır",
        items: [
          "Hesab: e-poçt ünvanı, şifrənin heşi (şifrənin özü saxlanılmır), rol və e-poçtun təsdiq vəziyyəti.",
          "Satıcı: mağaza məlumatları (ad, şəhər, ünvan, WhatsApp nömrəsi, iş saatları, xəritə koordinatları) və yoxlama üçün yüklənən sənədlər. Sənədlər məxfi saxlancdadır və yalnız qısa müddətli imzalı keçidlə açılır.",
          "Satıcı bəyannaməsi: qəbul tarixi və IP ünvanı (sübut kimi).",
          "Alıcı WhatsApp düyməsini basanda: məhsul və mağaza üzrə klik sayı. Mesajın özü Jeparla-dan keçmir.",
          "Şikayətlər: şikayətin mətni və səbəbi.",
          "Sui-istifadəyə qarşı limitlər: IP ünvanı və ya hesab üzrə qısa müddətli sayğaclar.",
        ],
      },
      {
        heading: "Saxlanılmayan məlumatlar",
        items: [
          '"Yaxınımdakı mağazalar" axtarışında göndərilən yer yalnız həmin cavab üçün istifadə olunur, saxlanılmır və keşlənmir.',
          "Seçilmişlər, müqayisə, son axtarışlar, tema və valyuta seçimi yalnız sizin brauzerinizdə qalır.",
          "Reklam və ya analitika izləyiciləri istifadə olunmur.",
        ],
      },
      {
        heading: "Xidmət provayderləri",
        items: [
          "Oracle Cloud: API serveri, PostgreSQL verilənlər bazası və Redis.",
          "Cloudflare R2: məhsul şəkilləri (açıq) və satıcı sənədləri (məxfi).",
          "Saytın hostinqi (frontend).",
          "E-poçt göndərmə xidməti (SMTP): təsdiq və şifrə bərpası məktubları.",
          "Sentry: xəta hesabatları (IP, cookie və istifadəçi identifikatoru göndərilmir).",
          "WhatsApp (Meta): alıcı mağazaya özü yazanda; bu, Jeparla-dan kənar xidmətdir.",
          "Azərbaycan Mərkəzi Bankı: metal və valyuta məzənnələri oxunur, ora heç bir şəxsi məlumat göndərilmir.",
        ],
        review:
          "Saytın hostinq provayderinin adı (Vercel, Cloudflare Pages və ya Netlify) və e-poçt provayderinin adı (Brevo, Resend və ya Amazon SES) seçiləndən sonra yazılmalıdır. Məlumatların ölkədən kənara ötürülməsi üçün hüquqi əsas hüquqşünasla təsdiqlənməlidir.",
      },
      {
        heading: "Hüquqi əsas və saxlama müddəti",
        review:
          '"Fərdi məlumatlar haqqında" Qanuna uyğun emal əsasları, hər məlumat növü üçün saxlama müddəti, verilənlər bazası ehtiyat nüsxələrinin saxlama müddəti və hesab silinəndə nə baş verdiyi.',
      },
      {
        heading: "Sizin hüquqlarınız və müraciət",
        review:
          "Məlumatlara baxmaq, düzəltmək və silmək hüquqları, müraciət qaydası, cavab müddəti və nəzarət orqanı.",
      },
    ],
  },
  terms: {
    title: "İstifadə şərtləri",
    description: "Jeparla platformasından istifadə qaydaları.",
    sections: [
      {
        heading: "Jeparla nədir",
        paragraphs: [
          "Jeparla zərgərlik mağazalarının məhsullarını bir kataloqda göstərir. Alıcı mağaza ilə WhatsApp vasitəsilə birbaşa əlaqə saxlayır. Jeparla satış tərəfi deyil, ödəniş qəbul etmir və çatdırılma etmir.",
          "Metala bağlı qiymətlər Azərbaycan Mərkəzi Bankının gündəlik məzənnəsi əsasında avtomatik yenilənir. USD və EUR ilə göstərilən qiymətlər təxminidir; qiymət manatla razılaşdırılır.",
        ],
      },
      {
        heading: "Satıcıların öhdəlikləri",
        paragraphs: [
          "Satıcı məhsul məlumatlarının (metal, əyar, çəki, daş, qiymət) doğruluğuna cavabdehdir. Qiymətli metal satıcılarının sənədləri platformada yoxlanılır.",
        ],
        review:
          "Satıcı ilə müqavilə şərtləri, yoxlama nəticəsində mağazanın dayandırılması qaydası və bəyannamə mətni (docs/legal/sellers-liability.md, #57 və #138).",
      },
      {
        heading: "Qadağan olunan istifadə",
        review: "Qadağan olunan hərəkətlərin siyahısı və hesabın bağlanması qaydası.",
      },
      {
        heading: "Məsuliyyətin həddi",
        review:
          "Jeparla-nın məsuliyyət həddi, alıcı ilə satıcı arasında mübahisələr və istehlakçı hüquqları.",
      },
      {
        heading: "Tətbiq olunan hüquq və dəyişikliklər",
        review:
          "Tətbiq olunan hüquq, mübahisələrin həlli yeri və şərtlər dəyişəndə istifadəçilərə necə bildiriləcəyi.",
      },
    ],
  },
  cookies: {
    title: "Cookie qaydası",
    description: "Jeparla hansı cookie-lərdən və brauzer yaddaşından istifadə edir.",
    sections: [
      {
        heading: "Cookie-lər",
        paragraphs: [
          "Yalnız girişin işləməsi üçün zəruri cookie-lər istifadə olunur. Reklam və analitika cookie-si yoxdur.",
        ],
        items: [
          "jeparla_session: daxil olmuş istifadəçinin sessiyası (sayt).",
          "jeparla_refresh: sessiyanın yenilənməsi üçün; yalnız API-yə göndərilir, JavaScript onu oxuya bilmir (httpOnly).",
        ],
      },
      {
        heading: "Brauzer yaddaşı (localStorage)",
        paragraphs: ["Bu məlumatlar yalnız sizin cihazınızda qalır və serverə göndərilmir:"],
        items: [
          "Seçilmişlər və müqayisə siyahısı.",
          "Son axtarışlar.",
          "Gecə/gündüz teması və valyuta seçimi.",
          "Satıcı formasının yarımçıq qaralaması.",
          "Tətbiqi quraşdırma təklifinin bağlanması.",
        ],
      },
      {
        heading: "Razılıq",
        review:
          "Yalnız zəruri cookie-lər üçün razılıq bannerinin tələb olunub-olunmadığını hüquqşünas təsdiqləməlidir.",
      },
    ],
  },
};
