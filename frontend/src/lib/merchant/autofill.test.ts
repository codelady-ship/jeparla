import { describe, expect, it } from "vitest";
import { filledFields, readProductText, type AutofillFineness } from "./autofill";

const categories = [
  { value: "nisan-uzukleri", label: "Nişan üzükləri" },
  { value: "toy-uzukleri", label: "Toy üzükləri" },
  { value: "sirgalar", label: "Sırğalar" },
  { value: "zencirler", label: "Zəncirlər" },
  { value: "asqilar", label: "Asqılar" },
  { value: "qolbaqlar", label: "Qolbaqlar" },
  { value: "destler", label: "Dəstlər" },
  { value: "broslar", label: "Broşlar" },
  { value: "kisi-zergerliyi", label: "Kişi zərgərliyi" },
  { value: "usaq-zergerliyi", label: "Uşaq zərgərliyi" },
];

const finenesses: AutofillFineness[] = [
  { value: "1", metal: "GOLD", fineness: 375 },
  { value: "2", metal: "GOLD", fineness: 585 },
  { value: "3", metal: "GOLD", fineness: 750 },
  { value: "8", metal: "GOLD", fineness: 916 },
  { value: "4", metal: "GOLD", fineness: 999 },
  { value: "5", metal: "SILVER", fineness: 925 },
  { value: "10", metal: "SILVER", fineness: 999 },
  { value: "6", metal: "PLATINUM", fineness: 950 },
];

const read = (text: string) => readProductText(text, { categories, finenesses });

describe("reading a product's text", () => {
  it("fills every field of an Azerbaijani catalog page", () => {
    const a = read(
      [
        "Leyla — qızıl nişan üzüyü",
        "Əyar 585, çəki 3,2 q",
        "Qiymət: 1 250,50 AZN",
        "Ağ brilyantlı klassik nişan üzüyü. Ölçü 16-18 hazırdır.",
      ].join("\n"),
    );
    expect(a).toEqual({
      name: "Leyla — qızıl nişan üzüyü",
      category: "nisan-uzukleri",
      metal: "GOLD",
      fineness: "2",
      weight: "3.2",
      price: "1250.50",
      description: "Ağ brilyantlı klassik nişan üzüyü. Ölçü 16-18 hazırdır.",
    });
    expect(filledFields(a)).toEqual([
      "name",
      "category",
      "metal",
      "fineness",
      "weight",
      "price",
      "description",
    ]);
  });

  it("reads English and Russian words and karats", () => {
    expect(read("Gold pendant 18K\n2.4 g\n₼ 640")).toMatchObject({
      category: "asqilar",
      metal: "GOLD",
      fineness: "3",
      weight: "2.4",
      price: "640",
    });
    expect(read("Серьги серебро 925\nВес: 5,5\n180 манат")).toMatchObject({
      category: "sirgalar",
      metal: "SILVER",
      fineness: "5",
      weight: "5.5",
      price: "180",
    });
  });

  it("takes the metal from a fineness that belongs to one metal only", () => {
    expect(read("Sırğa 925 əyar")).toMatchObject({ metal: "SILVER", fineness: "5" });
    expect(read("Üzük 999")).toMatchObject({ metal: null, fineness: null });
    expect(read("Gümüş üzük 999")).toMatchObject({ metal: "SILVER", fineness: "10" });
  });

  it("never reads a price, a weight or a size as a fineness", () => {
    expect(read("Qolbaq\n585 AZN\n750 q")).toMatchObject({
      fineness: null,
      price: "585",
      weight: "750",
    });
    expect(read("Qızıl zəncir 500 mm")).toMatchObject({ metal: "GOLD", fineness: null });
  });

  it("prefers who the piece is for over the piece itself", () => {
    expect(read("Uşaq sırğası, qızıl 585").category).toBe("usaq-zergerliyi");
    expect(read("Kişi üzüyü").category).toBe("kisi-zergerliyi");
    expect(read("Sırğa və üzük dəsti").category).toBe("destler");
  });

  it("leaves a parent-only word without a category", () => {
    expect(read("Qızıl üzük 585").category).toBeNull();
    expect(read("Boyunbağı").category).toBeNull();
  });

  it("only suggests categories the form offers", () => {
    expect(
      readProductText("Gold bracelet", { categories: categories.slice(0, 2), finenesses }).category,
    ).toBeNull();
  });

  it("does not see the English word 'ring' inside 'earring' as a ring category", () => {
    expect(read("Silver earrings 925").category).toBe("sirgalar");
  });

  it("returns nothing for an empty page", () => {
    expect(filledFields(read(""))).toEqual([]);
    expect(filledFields(read("  \n 12 \n"))).toEqual([]);
  });

  it("shortens a long description at a sentence end", () => {
    const long = Array.from({ length: 60 }, (_, i) => `Cümlə nömrə ${i} burada bitir.`).join(" ");
    const d = read(`Ad\n${long}`).description!;
    expect(d.length).toBeLessThanOrEqual(1000);
    expect(d.endsWith(".")).toBe(true);
  });
});

describe("reading pasted social text without confident wrong fills (#330 review)", () => {
  it("never reads a phone number as a fineness or a metal", () => {
    expect(read("Sırğa\nWhatsApp 055 585 12 34\n450 AZN")).toMatchObject({
      metal: null,
      fineness: null,
      price: "450",
    });
    expect(read("Qızıl sırğa 585\nƏlaqə: +994 50 750 12 34")).toMatchObject({
      metal: "GOLD",
      fineness: "2",
    });
    expect(read("Üzük, əlaqə 050-375-12-34")).toMatchObject({ fineness: null });
  });

  it("never reads a labelled price as a fineness", () => {
    expect(read("Üzük 17 ölçü\nQiymət: 750")).toMatchObject({
      metal: null,
      fineness: null,
      price: "750",
    });
    const a = read("Qiymət: 375\nQolbaq");
    expect(a).toMatchObject({ metal: null, fineness: null, price: "375", name: "Qolbaq" });
  });

  it("reads a bare fineness only next to a metal or fineness word", () => {
    expect(read("Model 585")).toMatchObject({ metal: null, fineness: null });
    expect(read("Model 585 əyar")).toMatchObject({ metal: "GOLD", fineness: "2" });
    expect(read("Кольцо проба 585")).toMatchObject({ metal: "GOLD", fineness: "2" });
  });

  it("does not join a fineness and a price into one number", () => {
    expect(read("Qızıl üzük 585 450 AZN")).toMatchObject({
      metal: "GOLD",
      fineness: "2",
      price: "450",
    });
    expect(read("Qızıl üzük 585\n1 250 AZN").price).toBe("1250");
  });

  it("does not read a year as grams", () => {
    expect(read("Кольцо золото 585\nКоллекция 2025 г.\n3,1 г").weight).toBe("3.1");
    expect(read("Кольцо золото 585, новинка 2024 г.").weight).toBeNull();
    expect(read("Üzük 2025 il kolleksiyası").weight).toBeNull();
  });

  it("prefers a labelled weight and ignores unlabelled weights over 1000 g", () => {
    expect(read("Qızıl qolbaq 585 1,5 q\nÇəki: 7,4").weight).toBe("7.4");
    expect(read("Qolbaq 1500 q").weight).toBeNull();
  });

  it("does not read a plating as the metal", () => {
    expect(read("Gold plated silver earrings 925")).toMatchObject({
      metal: "SILVER",
      fineness: "5",
    });
    expect(read("Qızıl suyuna salınmış gümüş sırğa 925")).toMatchObject({
      metal: "SILVER",
      fineness: "5",
    });
    expect(read("Серебро 925 с позолотой")).toMatchObject({ metal: "SILVER", fineness: "5" });
  });

  it("leaves the metal empty when the metal word and the fineness disagree", () => {
    expect(read("Qızıl sırğa 925")).toMatchObject({ metal: null, fineness: null });
  });

  it("keeps label and contact lines out of the name and the description", () => {
    const a = read(
      [
        "Qiymət: 375",
        "Gümüş qolbaq",
        "Çəki: 7,4",
        "Zərif gündəlik qolbaq, hər geyimə uyğundur.",
        "Əlaqə: +994 50 123 45 67",
        "#qolbaq #gumus",
      ].join("\n"),
    );
    expect(a.name).toBe("Gümüş qolbaq");
    expect(a.description).toBe("Zərif gündəlik qolbaq, hər geyimə uyğundur.");
  });

  it("takes the name of one-line text from before the first comma or digit", () => {
    expect(read("Leyla — qızıl nişan üzüyü, 585 əyar, 3,2 q, 1 250 AZN")).toMatchObject({
      name: "Leyla — qızıl nişan üzüyü",
      category: "nisan-uzukleri",
      metal: "GOLD",
      fineness: "2",
      weight: "3.2",
      price: "1250",
      description: null,
    });
  });

  it("still reads the cases that were right", () => {
    expect(read("Qızıl üzük 585 əyar, 3,2 q, 450 AZN")).toMatchObject({
      metal: "GOLD",
      fineness: "2",
      weight: "3.2",
      price: "450",
    });
    expect(read("Silver ring 925, 4.1 g, 120 ₼")).toMatchObject({
      metal: "SILVER",
      fineness: "5",
      weight: "4.1",
      price: "120",
    });
    expect(read("Серьги золото 750 2,8 г 900 манат")).toMatchObject({
      metal: "GOLD",
      fineness: "3",
      weight: "2.8",
      price: "900",
    });
    expect(read("Üzük 14k 2,5gr 300azn")).toMatchObject({
      metal: "GOLD",
      fineness: "2",
      weight: "2.5",
      price: "300",
    });
    expect(read("Ring 18 K white gold 3.0 g")).toMatchObject({ metal: "GOLD", fineness: "3" });
    expect(filledFields(read("17 ölçü"))).toEqual(["name"]);
    expect(read("25.11.2026")).toMatchObject({ fineness: null, weight: null, price: null });
  });
});

describe("follow-up of the #330 re-review", () => {
  it("never takes a label or a single word as a one-line name", () => {
    expect(read("Çəki: 12 q, 925 gümüş").name).toBeNull();
    expect(read("Gold 585 chain 1500 g").name).toBeNull();
    expect(read("Model 2025 il, qızıl üzük 4 q").name).toBeNull();
    expect(read("Qiymət 450, qızıl üzük").name).toBeNull();
    expect(read("Dəst: qızıl üzük proba 585, 4 q").name).toBe("Dəst: qızıl üzük");
    expect(read("Gümüş sırğa əyar 925, 3 q").name).toBe("Gümüş sırğa");
  });

  it("does not let hashtags decide the metal or the category", () => {
    expect(read("Sırğa 3 q\n#qizil #uzuk")).toMatchObject({ metal: null, category: "sirgalar" });
    expect(read("Yeni model\n#gumus #sirga")).toMatchObject({ metal: null, category: null });
  });
});
