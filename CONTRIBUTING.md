# Contributing to HumanOS

Thanks for your interest in contributing to HumanOS.

## Before You Start

- Search existing issues before opening a new one
- For security issues, use the private process in `SECURITY.md`
- Keep changes focused and scoped (avoid unrelated cleanup in the same PR)

## Ways to Contribute

- Bug fixes
- Documentation improvements
- Accessibility improvements
- Tests and reliability improvements
- Feature proposals (open an issue first for larger changes)

## Development Setup

1. Fork the repo
2. Clone your fork
3. Copy env file:

```bash
cp .env.example .env.local
```

4. Configure Supabase and API keys
5. Run migrations in `supabase/migrations`
6. Start dev server:

```bash
npm install
npm run dev
```

## Pull Request Guidelines

- Use clear PR titles and descriptions
- Explain user-facing behavior changes
- Include screenshots/video for UI changes when possible (using non-sensitive demo data)
- Note any migration or env var changes explicitly

## Code Style

- TypeScript / Next.js app router
- Prefer small, readable patches
- Match existing conventions in the repo

## AI-Assisted Contributions

AI-assisted contributions are welcome. If AI tools were used, please review outputs carefully and ensure the final PR is accurate and safe to merge.
