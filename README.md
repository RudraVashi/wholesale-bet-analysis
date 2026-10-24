# Formcast

Personal wholesale bet desk for **soccer (EPL / La Liga)** and **NBA**. Scan a slate, open a multi-factor dossier (L10/L20 form, dynamics, performance, off-pitch, line value), build a 2–4 leg PrizePicks Power play, and grade it in a local journal.

For fun research only — not financial advice.

## Features

- **Slate** — PrizePicks (paste + best-effort board), Polymarket, NBA sportsbook MLs, ESPN EPL/La Liga fixtures; kickoff times in America/Chicago; search / sort / group by game
- **Dossier** — factor scorecard + plain-English **Fan take**; home/away weighted heavily; L10/L20 form
- **Glossary** — in-app page + [`GLOSSARY.md`](GLOSSARY.md)
- **Off-pitch** — Gemini synthesis (injuries, rest, news) — never the sole number-cruncher
- **Power builder** — 2–4 legs with correlation / stinker warnings
- **Journal** — localStorage post-mortems (W/L/push + optional stake)

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, free-tier / public data adapters.

## Setup

```bash
npm install
cp .env.example .env.local
# add keys you have
npm run dev -- -p 43127
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

### Env keys (all optional except Gemini for off-pitch)

| Variable | Purpose | Cost |
|----------|---------|------|
| `GEMINI_API_KEY` | Off-pitch narrative | Free Gemini tier |
| `API_FOOTBALL_KEY` | Soccer player/team form | Free 100 req/day at [api-football.com](https://www.api-football.com/) |
| `ODDS_API_KEY` | Optional NBA moneylines | Free tier (NBA h2h only) |

No key needed for:

- **Polymarket** (public Gamma API)
- **ESPN** NBA gamelogs (unofficial public JSON)
- **PrizePicks** (unofficial board; often blocked from cloud IPs — use paste)

### Manual PrizePicks paste

If the auto board is empty or blocked, on the slate paste one line per prop:

```text
Jayson Tatum | Points | 27.5 | over
Mohamed Salah | Shots on Target | 1.5 | over
```

## Quotas & honesty

- Free APIs return **quota hit** banners instead of fake games.
- PrizePicks may **403** from datacenter IPs — paste is the reliable path.
- Cache lives in `.cache/` (gitignored) to stretch daily limits. Clear it from Settings.

## Scripts

```bash
npm run dev      # development
npm run build    # production build
npm run start    # production server
npm run lint     # eslint
```
