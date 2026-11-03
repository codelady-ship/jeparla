"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

type Props = {
  /** Accessible names; translated strings come from next-intl (issue #4). */
  labels: { toDark: string; toLight: string };
};

// Both icons are rendered and CSS picks one from the `.dark` class, so the server
// HTML matches the client and there is no hydration flash.
export function ThemeToggle({ labels }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? labels.toLight : labels.toDark}
    >
      <Moon aria-hidden className="dark:hidden" />
      <Sun aria-hidden className="hidden dark:block" />
    </Button>
  );
}
