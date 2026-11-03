import { Gem } from "lucide-react";

// Placeholder home page. Real sections and translations come with issues #4 and #15.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <Gem aria-hidden className="size-10 text-primary" />
      <h1 className="font-heading text-4xl font-semibold tracking-tight">Jeparla</h1>
    </main>
  );
}
