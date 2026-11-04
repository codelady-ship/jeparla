import type { LucideIcon } from "lucide-react";
import { RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function SavedEmpty({
  icon: Icon,
  title,
  text,
  cta,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
      <Icon aria-hidden className="size-8 text-muted-foreground" />
      <h2 className="text-xl">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{text}</p>
      <Link href="/products" className={buttonVariants({ variant: "outline" })}>
        {cta}
      </Link>
    </div>
  );
}

export function SavedError({
  text,
  retry,
  label,
}: {
  text: string;
  retry: () => void;
  label: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border px-6 py-12 text-center"
    >
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button type="button" variant="outline" onClick={retry}>
        <RotateCcw aria-hidden />
        {label}
      </Button>
    </div>
  );
}
