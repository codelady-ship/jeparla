import type { LegalContent } from "./types";

export const en: LegalContent = {
  privacy: {
    title: "Privacy policy",
    description: "What Jeparla stores, why, and which service providers it works with.",
    sections: [
      {
        heading: "Who processes the data",
        review:
          "The operator's legal name, tax id (VÖEN), address and contact email. The data protection contact person, if required.",
      },
      {
        heading: "What is stored",
        items: [
          "Account: email address, a hash of the password (the password itself is not stored), role and email confirmation status.",
          "Sellers: store details (name, city, address, WhatsApp number, opening hours, map coordinates) and the documents uploaded for verification. Documents are kept in private storage and open only through short-lived signed links.",
          "Seller declaration: the date it was accepted and the IP address (as evidence).",
          "When a buyer taps the WhatsApp button: a click count per product and store. The message itself does not pass through Jeparla.",
          "Reports: the text and reason of a report.",
          "Abuse limits: short-lived counters per IP address or account.",
        ],
      },
      {
        heading: "What is not stored",
        items: [
          'The location sent with "stores near me" is used for that answer only; it is neither stored nor cached.',
          "Favorites, compare, recent searches, theme and currency choice stay in your browser only.",
          "No advertising or analytics trackers are used.",
        ],
      },
      {
        heading: "Service providers",
        items: [
          "Oracle Cloud: the API server, the PostgreSQL database and Redis.",
          "Cloudflare R2: product images (public) and seller documents (private).",
          "Website hosting (frontend).",
          "Email delivery service (SMTP): confirmation and password reset emails.",
          "Sentry: error reports (no IP, cookies or user id are sent).",
          "WhatsApp (Meta): when a buyer writes to a store; this is a service outside Jeparla.",
          "Central Bank of Azerbaijan: metal and currency rates are read; no personal data is sent there.",
        ],
        review:
          "Name the website host (Vercel, Cloudflare Pages or Netlify) and the email provider (Brevo, Resend or Amazon SES) once chosen. The legal basis for transfers abroad must be confirmed with a lawyer.",
      },
      {
        heading: "Legal basis and retention",
        review:
          "Processing grounds under the Law on Personal Data, the retention period of each kind of data, the retention of database backups, and what happens when an account is deleted.",
      },
      {
        heading: "Your rights and requests",
        review:
          "Rights to access, correct and delete data, how to send a request, the response time and the supervisory authority.",
      },
    ],
  },
  terms: {
    title: "Terms of use",
    description: "The rules for using the Jeparla platform.",
    sections: [
      {
        heading: "What Jeparla is",
        paragraphs: [
          "Jeparla shows the products of jewelry stores in one catalog. Buyers contact a store directly through WhatsApp. Jeparla is not a party to the sale, takes no payments and does not deliver.",
          "Metal-linked prices update automatically with the daily rate of the Central Bank of Azerbaijan. Prices shown in USD and EUR are approximate; the price is agreed in AZN.",
        ],
      },
      {
        heading: "Sellers' obligations",
        paragraphs: [
          "Sellers are responsible for the accuracy of product data (metal, fineness, weight, stones, price). Documents of precious metal sellers are checked on the platform.",
        ],
        review:
          "The seller agreement, the rules for suspending a store after a check, and the declaration text (docs/legal/sellers-liability.md, #57 and #138).",
      },
      {
        heading: "Prohibited use",
        review: "The list of prohibited actions and how an account is closed.",
      },
      {
        heading: "Limitation of liability",
        review:
          "Jeparla's liability limits, disputes between buyers and sellers, and consumer rights.",
      },
      {
        heading: "Governing law and changes",
        review:
          "Governing law, the place of dispute resolution, and how users are told when the terms change.",
      },
    ],
  },
  cookies: {
    title: "Cookie notice",
    description: "Which cookies and browser storage Jeparla uses.",
    sections: [
      {
        heading: "Cookies",
        paragraphs: [
          "Only cookies needed for signing in are used. There are no advertising or analytics cookies.",
        ],
        items: [
          "jeparla_session: the signed-in user's session (website).",
          "jeparla_refresh: renews the session; sent only to the API and not readable by JavaScript (httpOnly).",
        ],
      },
      {
        heading: "Browser storage (localStorage)",
        paragraphs: ["This data stays on your device and is not sent to the server:"],
        items: [
          "Favorites and the compare list.",
          "Recent searches.",
          "Light/dark theme and currency choice.",
          "An unfinished seller form draft.",
          "Dismissal of the install-the-app prompt.",
        ],
      },
      {
        heading: "Consent",
        review:
          "A lawyer must confirm whether a consent banner is required for strictly necessary cookies only.",
      },
    ],
  },
};
