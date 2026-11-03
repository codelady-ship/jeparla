# Jeparla

Qızıl, gümüş və brilyant zərgərlik mağazaları üçün çoxmağazalı kataloq.

- Mağaza və kateqoriya üzrə axtarış, əyar, çəki, qiymət və brilyant parametrləri ilə filtrlər
- AMB-nin gündəlik metal məzənnəsi və metala bağlı avtomatik qiymət
- Jeparla Verified: satıcı, sənəd və ekspertiza statusları ayrı-ayrılıqda
- Mağaza kabineti, admin paneli, WhatsApp ilə əlaqə
- Az / En / Ru, gecə və gündüz rejimi

Layihə qurulma mərhələsindədir. Plan: [docs/PLAN.md](./docs/PLAN.md),
qaydalar: [CLAUDE.md](./CLAUDE.md), backlog: [BACKLOG.md](./BACKLOG.md).

## Struktur

```
frontend/   Next.js 16 + TypeScript
backend/    Java 21 + Spring Boot 4 + PostgreSQL 16
docs/       plan, dizayn, rollar, deploy, araşdırma
tools/      contrast.py (WCAG), sweep.py (köhnə ad yoxlaması)
```

## Alətlər

```bash
python3 tools/contrast.py docs/design/tokens.json
python3 tools/sweep.py frontend --config docs/brand.json
python3 tools/sweep.py backend --config docs/brand.json
```

`tools/` içindəki skriptlər [replica-skill](https://github.com/codelady-ship/replica-skill)
layihəsindəndir (MIT, `tools/LICENSE-replica-skill.txt`).
