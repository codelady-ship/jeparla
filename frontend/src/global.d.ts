import type { formats } from "./i18n/formats";
import type { Locale } from "./i18n/routing";
import type messages from "../messages/az.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
    Formats: typeof formats;
  }
}
