import type { GuideTexts } from "./types";

export const en: GuideTexts = {
  "585-vs-750-gold": {
    title: "585 and 750 gold: what is the difference",
    description:
      "What the numbers 585 and 750 on gold jewelry mean, how they match 14 and 18 karat, and what changes for the buyer.",
    answer:
      "The number is the fineness: how many parts of pure gold there are in 1000 parts of the alloy by mass. 585 gold is 58.5% gold and 750 gold is 75% gold; the rest is other metals. With the same weight, a 750 piece contains more gold than a 585 piece, so its metal is worth more.",
    sections: [
      {
        id: "fineness",
        title: "What the number means",
        blocks: [
          {
            type: "p",
            text: "Jewelry gold is an alloy: pure gold mixed with other metals. Millesimal fineness shows the share of pure gold in parts per thousand by mass. The stamp 585 means 585 of every 1000 parts are gold; 750 means 750 of every 1000 parts.",
          },
          {
            type: "p",
            text: "The karat system says the same thing in parts per 24. 750 is 18 karat (18/24 = 75%). 585 corresponds to 14 karat: 14/24 is 58.33%, and the decimal stamp used in practice is 585. 999 is gold with almost no other metals, also called 24 karat.",
          },
        ],
      },
      {
        id: "how-much-gold",
        title: "How much gold is in a piece",
        blocks: [
          {
            type: "p",
            text: "Multiply the weight by the fineness divided by 1000. For example, for a ring of 4 grams:",
          },
          {
            type: "ul",
            items: ["585: 4 × 0.585 = 2.34 g of pure gold", "750: 4 × 0.750 = 3.00 g of pure gold"],
          },
          {
            type: "p",
            text: "The example only shows the arithmetic; the weight of a real piece is on its product page and on the receipt.",
          },
        ],
      },
      {
        id: "what-changes",
        title: "What changes for the buyer",
        blocks: [
          {
            type: "ul",
            items: [
              "Metal value: the gram price of an alloy is proportional to its fineness, so a gram of 750 costs more than a gram of 585.",
              "Hardness: metals are added to gold to make jewelry harder and more durable.",
              "Color: the other metals in the alloy also change the color, which is why the same fineness comes in yellow, white or red gold.",
            ],
          },
        ],
      },
      {
        id: "choosing",
        title: "How to choose",
        blocks: [
          {
            type: "p",
            text: "There is no better or worse fineness, only a different share of gold. Choose by budget, color and how you will wear the piece. Before you buy, check that the fineness stamped on the piece matches the one in the description, and ask the store for a receipt that states the metal, fineness and weight.",
          },
          {
            type: "links",
            items: [
              { label: "How the gold price is calculated", href: "/guides/gold-price-calculation" },
              { label: "How to check a hallmark", href: "/guides/hallmark-check" },
            ],
          },
        ],
      },
    ],
  },

  "gold-price-calculation": {
    title: "How the gold price is calculated",
    description:
      "From the Central Bank's official metal rate to the price of a piece: gram price, fineness, weight, labor and the store's markup.",
    answer:
      "The metal part of the price starts from the price of one gram of pure gold. It is multiplied by the fineness (for example 585/1000) and by the weight of the piece. The store then adds labor, stones and its own markup, so the final price is always confirmed by the store.",
    sections: [
      {
        id: "source",
        title: "Where the gold price comes from",
        blocks: [
          {
            type: "p",
            text: "The Central Bank of the Republic of Azerbaijan (CBAR) publishes the official exchange rates of the manat. The list includes bank metals: gold (XAU), silver (XAG), platinum (XPT) and palladium (XPD), each priced per troy ounce.",
          },
          {
            type: "p",
            text: "One troy ounce is 31.1034768 grams. The price of one gram of pure metal is therefore the ounce price divided by 31.1034768.",
          },
        ],
      },
      {
        id: "alloy",
        title: "From pure gold to your alloy",
        blocks: [
          {
            type: "p",
            text: "Jewelry is made from alloys, so the gram price is adjusted for fineness:",
          },
          {
            type: "ul",
            items: [
              "gram price of the alloy = gram price of pure gold × fineness / 1000",
              "for 585 gold that is the pure gram price × 0.585, for 750 gold × 0.750",
            ],
          },
        ],
      },
      {
        id: "piece",
        title: "The price of a piece",
        blocks: [
          { type: "p", text: "The price of a finished piece is made of several parts:" },
          {
            type: "ol",
            items: [
              "Metal: weight in grams × gram price of the alloy.",
              "Labor: the work of making the piece, per gram or as a fixed amount.",
              "Stones, if any: priced by the store; there is no official daily rate for diamonds.",
              "The store's markup.",
            ],
          },
          {
            type: "p",
            text: "This is why two pieces of the same weight and fineness can cost differently: labor, design, stones and markup differ from store to store.",
          },
        ],
      },
      {
        id: "on-jeparla",
        title: "How it works on Jeparla",
        blocks: [
          {
            type: "p",
            text: "Jeparla takes the daily metal rates from the CBAR and shows the gram price for common finenesses with the date of the rate. A store can link a price to the metal rate: then the metal part is recalculated automatically when a new rate arrives, while labor, stones and markup stay as the store set them.",
          },
          {
            type: "p",
            text: "A price calculated this way is an estimate based on the CBAR's daily metal rate; the final price is confirmed by the store.",
          },
          {
            type: "links",
            items: [
              { label: "Today's metal prices on Jeparla", href: "/#metal-prices" },
              { label: "Official CBAR rates", href: "https://www.cbar.az/currency/rates" },
              {
                label: "585 and 750 gold: what is the difference",
                href: "/guides/585-vs-750-gold",
              },
            ],
          },
        ],
      },
    ],
  },

  "diamond-4c": {
    title: "The 4C of a diamond",
    description:
      "Cut, color, clarity and carat weight: what each of the four characteristics of diamond quality means and how to read them.",
    answer:
      "The 4C are four characteristics used to describe the quality of a diamond: cut, color, clarity and carat weight. GIA uses them in its grading system. Carat is weight, not size: one carat is 0.2 grams.",
    sections: [
      {
        id: "cut",
        title: "Cut",
        blocks: [
          {
            type: "p",
            text: "Cut describes how well the stone's proportions, symmetry and polish handle light. It decides the diamond's brightness, fire and scintillation. Cut grade is not the same as shape: a round or an oval stone can each be cut well or poorly.",
          },
        ],
      },
      {
        id: "color",
        title: "Color",
        blocks: [
          {
            type: "p",
            text: "Color is graded on the D-to-Z scale, from colorless (D) to light yellow or brown (Z). Graders compare the stone with master stones of known color. Colorless stones are rare, which is why D is the most valued grade.",
          },
        ],
      },
      {
        id: "clarity",
        title: "Clarity",
        blocks: [
          {
            type: "p",
            text: "Clarity is the relative absence of inclusions (inside the stone) and blemishes (on its surface). The GIA scale has 11 grades:",
          },
          {
            type: "ul",
            items: [
              "FL: Flawless",
              "IF: Internally Flawless",
              "VVS1, VVS2: Very, Very Slightly Included",
              "VS1, VS2: Very Slightly Included",
              "SI1, SI2: Slightly Included",
              "I1, I2, I3: Included",
            ],
          },
        ],
      },
      {
        id: "carat",
        title: "Carat weight",
        blocks: [
          {
            type: "p",
            text: "A metric carat is 0.2 grams. A carat is divided into 100 points, so a 0.50 ct stone is also called a 50-point stone. Carat is weight: two stones of the same weight can look different in size depending on their cut.",
          },
        ],
      },
      {
        id: "buying",
        title: "How to use the 4C when buying",
        blocks: [
          {
            type: "ul",
            items: [
              "Look at all four characteristics together; one of them alone does not describe a stone.",
              "Ask the store for the grading report from a gemological laboratory if the stone has one, and check that its data match the description.",
              "On Jeparla, the stone data on a product page are entered by the store; confirm them with the store before you buy.",
            ],
          },
          {
            type: "links",
            items: [{ label: "How to check a hallmark", href: "/guides/hallmark-check" }],
          },
        ],
      },
    ],
  },

  "hallmark-check": {
    title: "How to check a hallmark",
    description:
      "What a hallmark on gold and silver jewelry is, where to find it, what to check before buying and what a hallmark does not tell you.",
    answer:
      "A hallmark is a set of marks stamped on an item made of precious metal. First find the fineness number, for example 585 or 750 for gold and 925 for silver, usually on the inside of a ring, on a clasp or on an earring post. Check that it matches the fineness in the description and ask for a receipt. A stamp shows what is declared; the actual metal content can only be measured by testing.",
    sections: [
      {
        id: "what",
        title: "What a hallmark is",
        blocks: [
          {
            type: "p",
            text: "A hallmark usually consists of several small marks. In the countries of the international Hallmarking Convention, an article marked under the Convention carries:",
          },
          {
            type: "ul",
            items: [
              "the responsibility mark of the manufacturer or sponsor;",
              "the fineness mark;",
              "the national assay office mark;",
              "the Common Control Mark, which the Convention calls a passport that lets the article cross borders.",
            ],
          },
          {
            type: "p",
            text: "Every country uses its own designs, so this guide does not show them. The common element to look for is the fineness number.",
          },
        ],
      },
      {
        id: "where",
        title: "Where to look",
        blocks: [
          {
            type: "ul",
            items: [
              "Ring: on the inner side of the band.",
              "Chain or bracelet: on the clasp or on a small tag next to it.",
              "Earrings: on the post, the hook or the clip.",
              "Pendant: on the bail or the back.",
            ],
          },
          { type: "p", text: "The marks are small; a magnifying glass and good light help." },
        ],
      },
      {
        id: "check",
        title: "What to check before buying",
        blocks: [
          {
            type: "ol",
            items: [
              "The fineness number on the piece matches the fineness in the description.",
              "The weight on the receipt matches the weight in the description.",
              "The receipt states the metal, the fineness and the weight.",
              "If a mark is missing or unreadable, ask the store before you pay.",
            ],
          },
        ],
      },
      {
        id: "azerbaijan",
        title: "In Azerbaijan",
        blocks: [
          {
            type: "p",
            text: "Azerbaijan has a state assay control system. In July 2026, the State Agency for Antimonopoly and Consumer Market Control under the President (Antiinhisar və İstehlak Bazarına Nəzarət Dövlət Agentliyi) explained to jewelry sellers how state assay control applies and what liability the law sets for offering precious metal items for sale without a hallmark (AZERTAC report, see the sources).",
          },
        ],
      },
      {
        id: "limits",
        title: "What a hallmark does not tell you",
        blocks: [
          {
            type: "p",
            text: "A hallmark is about the metal only. It says nothing about the quality of the stones; for a diamond, look at the 4C and the laboratory grading report. Home tricks cannot measure fineness: if in doubt, ask for testing at a specialized laboratory.",
          },
          {
            type: "links",
            items: [
              { label: "The 4C of a diamond", href: "/guides/diamond-4c" },
              {
                label: "585 and 750 gold: what is the difference",
                href: "/guides/585-vs-750-gold",
              },
            ],
          },
        ],
      },
    ],
  },

  "silver-jewelry-care": {
    title: "Caring for silver jewelry",
    description:
      "Why silver darkens, how to store it so it tarnishes less, how to clean it gently and which methods remove metal.",
    answer:
      "Silver darkens because sulphur compounds in the air form a thin layer of black silver sulphide on it. To slow this down, keep the jewelry clean and dry and store each piece in a sealed polyethylene bag. Polish gently with a silver cloth only when needed: every polish removes a little silver.",
    sections: [
      {
        id: "why",
        title: "Why silver darkens",
        blocks: [
          {
            type: "p",
            text: "Tarnish is mainly black silver sulphide. It forms when silver reacts with sulphur-containing compounds in the air, such as hydrogen sulphide. Salts and oils from the skin can also leave marks. Jewelry silver is usually the 925 alloy: 92.5% silver and 7.5% other metals, usually copper.",
          },
        ],
      },
      {
        id: "storage",
        title: "Storage",
        blocks: [
          {
            type: "ul",
            items: [
              "Put jewelry away clean and dry.",
              "Keep each piece in its own polyethylene bag and seal it; this keeps air with sulphur compounds away.",
              "Cloths with embedded silver particles that absorb tarnishing gases are especially effective.",
              "Low humidity helps; a sachet of silica gel in the box absorbs moisture.",
            ],
          },
        ],
      },
      {
        id: "everyday",
        title: "Every day",
        blocks: [
          {
            type: "p",
            text: "After wearing, wipe the piece with a soft, dry cloth to remove skin salts and oils before you put it away.",
          },
        ],
      },
      {
        id: "cleaning",
        title: "Gentle cleaning",
        blocks: [
          {
            type: "ol",
            items: [
              "Wash in water with a little mild detergent.",
              "Rinse with clean water.",
              "Dry completely with a soft cloth.",
            ],
          },
          {
            type: "p",
            text: "Pieces with stones, pearls, glued or non-metal parts should not be soaked; ask the store how to clean them.",
          },
        ],
      },
      {
        id: "polishing",
        title: "Polishing and what to avoid",
        blocks: [
          {
            type: "ul",
            items: [
              "Polishes are abrasive: they remove a little silver along with the tarnish, so polish only when needed.",
              "Do not use general, multi-purpose metal polishes on silver.",
              "Chemical dips can over-clean silver and are corrosive; never use them on pieces with sealed hollow parts.",
              "The aluminum and soda method can pit the surface and often leaves a dull matte finish; the silver may also tarnish more quickly afterwards.",
              "If a piece is plated or deliberately darkened, ask the store before polishing: polishes and dips act on the surface.",
            ],
          },
          {
            type: "links",
            items: [{ label: "How to check a hallmark", href: "/guides/hallmark-check" }],
          },
        ],
      },
    ],
  },
};
