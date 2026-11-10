import { getTranslations } from "next-intl/server";
import type { ShareLabels } from "./share-button";

/** Translated labels for <ShareButton> (server components pass them down). */
export async function shareLabels(): Promise<ShareLabels> {
  const t = await getTranslations("Share");
  return { share: t("share"), copy: t("copy"), copied: t("copied"), copyFailed: t("copyFailed") };
}
