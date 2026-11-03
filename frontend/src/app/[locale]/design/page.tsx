import type { Metadata } from "next";
import { Gem, Search } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Internal design reference for developers. Not indexed, not linked from the site.
// Copy here is Azerbaijani only; user-facing pages get translations in issue #4.
export const metadata: Metadata = {
  title: "Dizayn sistemi | Jeparla",
  robots: { index: false, follow: false },
};

const SWATCHES = [
  { name: "background", className: "bg-background text-foreground" },
  { name: "card / surface", className: "bg-card text-card-foreground" },
  { name: "muted", className: "bg-muted text-muted-foreground" },
  { name: "primary", className: "bg-primary text-primary-foreground" },
  { name: "gold", className: "bg-gold text-on-gold" },
  { name: "destructive", className: "bg-destructive text-on-destructive" },
  { name: "success", className: "bg-success text-background" },
  { name: "warning", className: "bg-warning text-background" },
];

export default function DesignPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Gem aria-hidden className="size-7 text-gold-text" />
          <h1 className="font-heading text-3xl font-semibold">Dizayn sistemi</h1>
        </div>
        <ThemeToggle labels={{ toDark: "Gecə rejimi", toLight: "Gündüz rejimi" }} />
      </header>

      <section aria-labelledby="palette" className="flex flex-col gap-4">
        <h2 id="palette" className="font-heading text-2xl">
          Rənglər
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map((s) => (
            <li
              key={s.name}
              className={`flex h-24 items-end rounded-lg border p-3 text-sm font-medium ${s.className}`}
            >
              {s.name}
            </li>
          ))}
        </ul>
        <p className="text-gold-text">gold-text: qızılı ikon və link rəngi (fonda qızılı yox)</p>
      </section>

      <section aria-labelledby="type" className="flex flex-col gap-3">
        <h2 id="type" className="font-heading text-2xl">
          Tipoqrafiya
        </h2>
        <p className="font-heading text-4xl">Əsl zərgərlik, şəffaf qiymət</p>
        <p className="font-heading text-2xl">Ювелирные украшения из золота</p>
        <p className="max-w-prose text-muted-foreground">
          Mətn şrifti Inter: Ə ə İ ı Ş ş Ç ç Ğ ğ Ö ö Ü ü, Ж ж Щ щ Ё ё. Qiymətlər həmişə bu şriftlə
          yazılır, çünki başlıq şriftində manat işarəsi yoxdur.
        </p>
        <p className="text-2xl font-semibold tabular-nums">1 248,50 ₼</p>
      </section>

      <section aria-labelledby="controls" className="flex flex-col gap-4">
        <h2 id="controls" className="font-heading text-2xl">
          Düymələr və nişanlar
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button>Əsas</Button>
          <Button variant="gold">WhatsApp ilə yaz</Button>
          <Button variant="secondary">İkinci dərəcəli</Button>
          <Button variant="outline">Kontur</Button>
          <Button variant="ghost">Şəffaf</Button>
          <Button variant="destructive">Sil</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Deaktiv</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>585 əyar</Badge>
          <Badge variant="gold">Jeparla Verified</Badge>
          <Badge variant="secondary">Gümüş</Badge>
          <Badge variant="outline">Yeni</Badge>
          <Badge variant="destructive">Stokda yoxdur</Badge>
        </div>
      </section>

      <section aria-labelledby="motion" className="flex flex-col gap-4">
        <h2 id="motion" className="font-heading text-2xl">
          Hərəkət
        </h2>
        <p className="max-w-prose text-muted-foreground">
          Kartlar scroll ilə növbə ilə görünür. Şəklin üzərinə gələndə yavaş zoom və ikinci şəkil;
          linkin alt xətti soldan sağa çəkilir.
        </p>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {["Üzüklər", "Sırğalar", "Boyunbağılar", "Qolbaqlar"].map((name, i) => (
            <Reveal as="li" key={name} index={i}>
              <a href="#motion" className="group block">
                <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
                  <div className="absolute inset-0 img-zoom bg-linear-to-br from-muted to-gold/40" />
                  <div className="absolute inset-0 bg-linear-to-tr from-primary/80 to-gold/60 img-swap" />
                </div>
                <span className="mt-2 inline-block link-underline text-sm font-medium">{name}</span>
              </a>
            </Reveal>
          ))}
        </ul>
      </section>

      <section aria-labelledby="forms" className="flex flex-col gap-4">
        <h2 id="forms" className="font-heading text-2xl">
          Forma
        </h2>
        <div className="flex max-w-sm flex-col gap-2">
          <Label htmlFor="design-search">Axtarış</Label>
          <div className="relative">
            <Search
              aria-hidden
              className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input id="design-search" placeholder="üzük, sırğa, mağaza..." className="pl-8" />
          </div>
        </div>
      </section>

      <section aria-labelledby="surfaces" className="grid gap-6 sm:grid-cols-2">
        <h2 id="surfaces" className="font-heading text-2xl sm:col-span-2">
          Kart, dialoq, panel
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Nişan üzüyü, 750 əyar</CardTitle>
            <CardDescription>3,2 q, 0,30 ct brilyant</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold tabular-nums">2 940,00 ₼</p>
          </CardContent>
          <CardFooter className="gap-2">
            <Badge variant="gold">Verified</Badge>
            <span className="text-xs text-muted-foreground">Qiymət bu gün yeniləndi</span>
          </CardFooter>
        </Card>
        <div className="flex flex-wrap items-start gap-3">
          <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>Dialoqu aç</DialogTrigger>
            <DialogContent closeLabel="Bağla">
              <DialogHeader>
                <DialogTitle>Müqayisəyə əlavə olundu</DialogTitle>
                <DialogDescription>Ən çox 4 məhsulu müqayisə edə bilərsiniz.</DialogDescription>
              </DialogHeader>
              <DialogFooter showCloseButton closeLabel="Bağla" />
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>Paneli aç</SheetTrigger>
            <SheetContent closeLabel="Bağla">
              <SheetHeader>
                <SheetTitle>Filtrlər</SheetTitle>
                <SheetDescription>Mobil filtr paneli belə açılır.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </div>
      </section>
    </div>
  );
}
