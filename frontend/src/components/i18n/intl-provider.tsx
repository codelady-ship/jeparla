"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";
import { formats } from "@/i18n/formats";
import type { Locale } from "@/i18n/routing";

// The server flavour of NextIntlClientProvider reads the request config (locale, now,
// time zone), which counts as runtime data and breaks prerendering with Cache
// Components on dynamic routes. Passing everything explicitly keeps pages static.
export function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: AbstractIntlMessages;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      formats={formats}
      timeZone="Asia/Baku"
    >
      {children}
    </NextIntlClientProvider>
  );
}
