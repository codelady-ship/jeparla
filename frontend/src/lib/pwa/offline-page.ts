import colors from "@/lib/brand-colors.json";
import { OFFLINE_ICON } from "./service-worker";

type Palette = (typeof colors)["light"];

/** The roles the page uses, as CSS variables (values come from the design tokens). */
const vars = (p: Palette) =>
  [
    ["bg", p.bg],
    ["text", p.text],
    ["muted", p["text-muted"]],
    ["primary", p.primary],
    ["on-primary", p["on-primary"]],
    ["ring", p.ring],
  ]
    .map(([k, v]) => `--${k}:${v}`)
    .join(";");

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * The page the service worker shows when a page cannot load. A self-contained HTML
 * file (inline styles, a few lines of script) so it works with nothing else cached:
 * no Next.js runtime, no chunks. It follows the saved theme (next-themes key) or the
 * system setting, and reloads itself when the connection comes back.
 */
export function offlinePageHtml({
  locale,
  title,
  text,
  retry,
}: {
  locale: string;
  title: string;
  text: string;
  retry: string;
}): string {
  return `<!doctype html>
<html lang="${escape(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="${colors.light.bg}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${colors.dark.bg}" media="(prefers-color-scheme: dark)">
<title>${escape(title)} | Jeparla</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<script>try{var t=localStorage.getItem("jeparla-theme");if(t==="dark"||t==="light")document.documentElement.className=t}catch(e){}</script>
<style>
:root{${vars(colors.light)};color-scheme:light}
:root.dark{${vars(colors.dark)};color-scheme:dark}
@media (prefers-color-scheme:dark){:root:not(.light){${vars(colors.dark)};color-scheme:dark}}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text)}
body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
main{box-sizing:border-box;min-height:100svh;display:grid;place-items:center;padding:3rem 1rem calc(3rem + env(safe-area-inset-bottom))}
.box{max-width:24rem;text-align:center}
img{display:block;margin:0 auto 2rem;border-radius:0.875rem}
h1{font-family:Cormorant,"Cormorant Garamond",Georgia,serif;font-weight:500;font-size:2.25rem;line-height:1.1;margin:0 0 0.75rem}
p{color:var(--muted);line-height:1.6;margin:0 0 2rem}
button{min-height:2.75rem;padding:0 1.5rem;border:0;border-radius:999px;background:var(--primary);color:var(--on-primary);font:inherit;font-weight:500;cursor:pointer;transition:transform 150ms cubic-bezier(0.22,1,0.36,1)}
button:active{transform:scale(0.97)}
button:focus-visible{outline:3px solid var(--ring);outline-offset:3px}
@media (prefers-reduced-motion:reduce){button{transition:none}}
</style>
</head>
<body>
<main>
<div class="box">
<img src="${OFFLINE_ICON}" alt="" width="56" height="56">
<h1>${escape(title)}</h1>
<p>${escape(text)}</p>
<button type="button" onclick="location.reload()">${escape(retry)}</button>
</div>
</main>
<script>addEventListener("online",function(){location.reload()})</script>
</body>
</html>
`;
}
