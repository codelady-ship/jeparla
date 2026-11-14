# Jeparla frontend

Next.js 16 (App Router), TypeScript strict, Tailwind v4, shadcn/ui, lucide-react, Vitest.

Node 22+ lazımdır (`.nvmrc`).

```bash
npm install
npm run dev          # http://localhost:3000
npm run build
npm run lint
npm run typecheck
npm test
npm run format
```

`npm run build` iki rejimdə işləyir:

- **Real API** (`NEXT_PUBLIC_USE_MOCK` boş və ya `false`): build ictimai səhifələri kataloq
  məlumatı ilə əvvəlcədən render edir, ona görə backend (`NEXT_PUBLIC_API_URL`) cavab verməlidir.
  Cavab vermirsə `prebuild` (`scripts/check-api.mjs`) build-i dərhal aydın mesajla dayandırır.
- **Nümunə data** (`NEXT_PUBLIC_USE_MOCK=true npm run build`): backend lazım deyil; banner və
  `noindex` ilə. CI (`.github/workflows/frontend.yml`) bu rejimdə build edir.

Commit zamanı husky `lint-staged` işə salır: dəyişən fayllar ESLint və Prettier-dən keçir.
Qaydalar: [../CLAUDE.md](../CLAUDE.md).
