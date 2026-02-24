# HumanOS

HumanOS is an open-source private community platform for small groups that want a shared space for notes, files, chat, AI tools, images, and task lists.

Built with Next.js + Supabase.

## Features

- Rich-text notes
- File vault / document storage
- Human chat channels (shared group chat)
- AI chat threads (shared or private)
- Image generation + edits (OpenAI GPT Image, optional xAI Grok Imagine generation)
- To Do boards
- In-app notifications
- Role-based access controls
- Theme customization
- Mobile-friendly chat UX

## Stack

- Next.js (App Router)
- TypeScript
- Supabase Auth / Database / Storage
- OpenAI + Anthropic (optional, based on your API keys)
- xAI / Grok (optional, via `XAI_API_KEY`)
- GIPHY API (optional, for GIF picker in Human Chat)

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Create local env file

```bash
cp .env.example .env.local
```

3. Fill in `.env.local`

- Supabase URL + anon key
- Supabase service role key
- OpenAI and/or Anthropic API keys
- Optional xAI API key for Grok (`XAI_API_KEY`)
- Optional GIPHY API key for GIF picker

4. Create your Supabase project schema

- Run the SQL migrations in `supabase/migrations` in order
- This repo expects those migrations to be applied before the app is fully functional

5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

See `.env.example`.

## Deployment (Vercel)

1. Import the repo in Vercel
2. Add env vars in Vercel Project Settings
3. Apply Supabase migrations to your production database
4. Deploy

Notes:
- `NEXT_PUBLIC_*` variables are exposed to the browser (expected for public client keys such as GIPHY)
- Keep server secrets out of `NEXT_PUBLIC_*` variables

## Public Repo Notes

- This project is intended as a customizable base platform
- You can rename/rebrand modules and copy to fit your use case
- SQL migrations are intentionally committed in the public version
- Review RBAC and moderation settings before production use

## Roles (Default HumanOS Setup)

HumanOS ships with three roles by default:

- `Admin` (workspace owner/operator)
- `Member (adult)` (standard user)
- `Child (minor)` (optional minor safety mode)

This keeps the platform broadly useful for private communities while also supporting family and youth-safe use cases.

### Current role behavior (defaults)

- `Admin`
  - Can invite users
  - Can manage member roles
  - Can access admin settings (including billing estimate settings)
- `Member (adult)`
  - Standard access to shared/private content based on ownership + sharing
  - Can use AI chat and image generation (when configured)
- `Child (minor)`
  - Uses child-safe AI guardrails in AI chat
  - AI model selection is intentionally limited to Claude (UI + server) for consistency
  - Cannot invite users or manage users
  - Can still use image generation and core collaboration features

You can customize this role model (or remove the minor role entirely) to match your organization or community.

## About Risk Averse Tech

HumanOS is maintained by Risk Averse Tech as an open foundation for private community and collaboration platforms. The public repo is intended to be a practical starting point for self-hosters and teams, while Risk Averse Tech can provide custom setup, branding, integrations, and bespoke feature development for organizations that want a tailored version without handling all the engineering work internally.

This project was developed with AI-assisted engineering support from OpenAI Codex and Claude.

## Customization & Support

If you want a private, branded, production-ready version of HumanOS without doing all the engineering work yourself, Risk Averse Tech offers customization and implementation support.

Examples:

- deployment and infrastructure setup
- branding / UI customization
- feature additions and workflow changes
- API integrations and automations
- ongoing maintenance and support

Learn more: [Risk Averse Tech](https://www.riskaversetechnology.company/)

## License

MIT (see `LICENSE`)
