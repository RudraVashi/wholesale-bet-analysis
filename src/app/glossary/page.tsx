import { Card, CardBody, CardHeader } from "@/components/ui/card";
import Link from "next/link";

const SECTIONS: { title: string; rows: [string, string][] }[] = [
  {
    title: "Board / workflow",
    rows: [
      ["Slate", "Today’s list of bets and games."],
      ["Dossier", "Deep dive on one bet — scores, logs, news."],
      ["Power", "PrizePicks 2–4 leg over/under entry."],
      ["Journal", "Saved picks + W/L in your browser."],
      ["Manual paste", "Type lines when auto PrizePicks is blocked."],
    ],
  },
  {
    title: "Scorecard",
    rows: [
      [
        "Wholesale form (L10/L20)",
        "Hit rate vs the line over the last 10 / 20 games.",
      ],
      [
        "Last 5",
        "Hit or miss in each of the five newest games we have, the same strip PrizePicks shows. Tonight’s game is not included.",
      ],
      [
        "Consecutive streak",
        "How many newest games in a row cleared the pasted side (over or under). We then ask: after that many straight hits historically, how often did the next game continue vs break.",
      ],
      [
        "L5 count read",
        "Secondary: when the five before a game had the same hit count as today’s L5 (not necessarily consecutive), how often the next game hit. Fewer than 3 examples is too thin to lean on.",
      ],
      ["Hit rate", "% of those games that would have won the side."],
      ["Home / away (dynamics)", "Venue + rest. We weight this heavily."],
      ["Performance", "Average vs the line and how streaky they are."],
      ["Off-pitch", "Injuries, news, drama — Gemini narrative."],
      ["Line value", "Our lean vs what the market price implies."],
      ["Composite / score", "Weighted 0–100 blend of factors."],
      ["Confidence", "How much to trust that score."],
      ["Stinker check", "Thin edge / trap warning — consider passing."],
      ["Edge", "How far above “meh” the play looks."],
      ["Pass", "No clear side — skip it."],
    ],
  },
  {
    title: "Markets",
    rows: [
      ["Line", "The number (e.g. 27.5 points)."],
      ["Over / under", "More or less than the line."],
      ["Moneyline", "Who wins the game."],
      ["Implied probability", "Chance baked into the odds."],
      ["PRA / SoT", "Points+rebounds+assists / shots on target."],
      ["Props", "Player stat bets."],
    ],
  },
];

export default function GlossaryPage() {
  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="mono text-2xl tracking-tight">Glossary</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--fg-muted)]">
          Technical terms in normal language. Every dossier also has a{" "}
          <span className="text-[var(--accent)]">Fan take</span> box that
          explains that specific bet without jargon. Full markdown copy lives in{" "}
          <span className="mono">GLOSSARY.md</span> in the repo.
        </p>
        <p className="mt-2 text-xs text-[var(--fg-dim)]">
          <Link href="/" className="text-[var(--accent)]">
            ← back to slate
          </Link>
        </p>
      </div>

      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <div className="mono text-xs uppercase tracking-wider text-[var(--accent)]">
              {section.title}
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {section.rows.map(([term, def]) => (
              <div
                key={term}
                className="grid gap-1 border-b border-[var(--border)]/50 pb-3 last:border-0 md:grid-cols-[200px_1fr]"
              >
                <div className="mono text-sm text-[var(--fg)]">{term}</div>
                <div className="text-sm text-[var(--fg-muted)]">{def}</div>
              </div>
            ))}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}