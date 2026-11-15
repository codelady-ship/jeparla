"use client";

import { Download, Printer, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShareButton, type ShareLabels } from "@/components/share/share-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { notices } from "@/lib/notice";
import type { ShareLink } from "@/types/share";

export type ShareCatalogLabels = {
  linkLabel: string;
  qrTitle: string;
  qrAlt: string;
  qrUnavailable: string;
  downloadPng: string;
  print: string;
  inactive: string;
  regenerate: string;
  regenerateTitle: string;
  regenerateText: string;
  regenerateConfirm: string;
  cancel: string;
  regenerated: string;
  failed: string;
  share: ShareLabels;
};

const QR_SRC = "/api/merchant/share/qr";
/** PNG side in pixels: sharp enough for an A5 print. */
const PNG_SIZE = 1200;

/** Draws the SVG QR code on a canvas and saves it as a PNG (no QR library in the browser). */
async function downloadPng(fileName: string): Promise<boolean> {
  try {
    const res = await fetch(QR_SRC, { cache: "no-store" });
    if (!res.ok) return false;
    const url = URL.createObjectURL(await res.blob());
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = PNG_SIZE;
      canvas.height = PNG_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, PNG_SIZE, PNG_SIZE);
      const png = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
      if (!png) return false;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(png);
      link.download = fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
      return true;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return false;
  }
}

/**
 * "Share your catalog" (#100): the short link to copy or share, its QR code (PNG for print)
 * and a new link when the old one leaked. The QR image is served by this site with the
 * session cookie; the backend draws it for the store of the signed-in seller only.
 */
export function ShareCatalog({
  link,
  storeName,
  qrAvailable,
  labels,
}: {
  link: ShareLink;
  storeName: string;
  /** False with the sample data: there is no backend to draw the QR code. */
  qrAvailable: boolean;
  labels: ShareCatalogLabels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  async function regenerate() {
    setBusy(true);
    try {
      const res = await fetch("/api/merchant/share/regenerate", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { errors?: { form?: string } };
        const form = body.errors?.form;
        notices.show(form && /\s/.test(form) ? form : labels.failed);
        return;
      }
      setOpen(false);
      setVersion((v) => v + 1);
      notices.show(labels.regenerated);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onDownload() {
    if (!(await downloadPng(`jeparla-qr-${link.code}.png`))) notices.show(labels.failed);
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_auto]">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {labels.linkLabel}
          <input
            readOnly
            value={link.url}
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 w-full rounded-md border border-input bg-background px-3 font-mono text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        {!link.active && <p className="text-sm text-warning">{labels.inactive}</p>}
        <div className="flex flex-wrap gap-2">
          <ShareButton labels={labels.share} url={link.url} title={storeName} />
          <Button
            type="button"
            variant="ghost"
            className="h-11 sm:h-10"
            onClick={() => setOpen(true)}
          >
            <RefreshCw aria-hidden />
            {labels.regenerate}
          </Button>
        </div>
      </div>

      <figure className="flex flex-col items-center gap-3">
        {qrAvailable ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, per-seller SVG; next/image would cache it
          <img
            key={version}
            src={`${QR_SRC}?v=${link.code}`}
            alt={labels.qrAlt}
            width={192}
            height={192}
            className="size-48 rounded-md border bg-card p-1"
          />
        ) : (
          <p className="flex size-48 items-center rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            {labels.qrUnavailable}
          </p>
        )}
        <figcaption className="text-sm text-muted-foreground">{labels.qrTitle}</figcaption>
        {qrAvailable && (
          <div className="flex gap-2 print:hidden">
            <Button type="button" variant="outline" className="h-11 sm:h-10" onClick={onDownload}>
              <Download aria-hidden />
              {labels.downloadPng}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 sm:h-10"
              onClick={() => window.print()}
            >
              <Printer aria-hidden />
              {labels.print}
            </Button>
          </div>
        )}
      </figure>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{labels.regenerateTitle}</DialogTitle>
          <DialogDescription>{labels.regenerateText}</DialogDescription>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{labels.cancel}</DialogClose>
            <Button type="button" variant="destructive" disabled={busy} onClick={regenerate}>
              {labels.regenerateConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
