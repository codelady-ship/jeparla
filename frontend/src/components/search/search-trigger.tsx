import { Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

/**
 * Look of the header search button, shared by the light launcher and the dialog's own
 * trigger so nothing jumps when the dialog chunk takes over: an icon button on phones and
 * tablets, a quiet search field with its label on wide screens.
 */
export const SEARCH_TRIGGER = cn(
  buttonVariants({ variant: "ghost", size: "icon" }),
  "lg:h-9 lg:w-52 lg:justify-start lg:gap-2 lg:rounded-full lg:bg-muted lg:px-3.5 lg:text-sm lg:font-normal lg:text-muted-foreground",
);

export function SearchTriggerContent({ label }: { label: string }) {
  return (
    <>
      <Search aria-hidden />
      <span aria-hidden className="hidden lg:inline">
        {`${label}…`}
      </span>
    </>
  );
}
