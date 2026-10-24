"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { SourceStatus } from "@/lib/types";
import { useEffect, useState } from "react";

export function SettingsView() {
  const [statuses, setStatuses] = useState<SourceStatus[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/status");
      const json = (await res.json()) as { statuses: SourceStatus[] };
      setStatuses(json.statuses);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function clearCache() {
    const res = await fetch("/api/status", { method: "DELETE" });
    const json = (await res.json()) as { cleared: number };
    setMessage(`Cleared ${json.cleared} cache files.`);
    await refresh();
  }

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="mono text-2xl tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Free-tier sources only. Keys live in{" "}
          <span className="mono">.env.local</span> — never commit them.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="mono text-xs uppercase tracking-wider text-[var(--accent)]">
            Source status
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          {loading && statuses.length === 0 ? (
            <p className="mono text-sm text-[var(--fg-dim)]">Checking…</p>
          ) : null}
          {statuses.map((s) => (
            <div
              key={s.key}
              className="flex items-start justify-between gap-3 border-b border-[var(--border)]/50 pb-2 last:border-0"
            >
              <div>
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs text-[var(--fg-dim)]">{s.detail}</div>
              </div>
              <Badge tone={s.ok ? "good" : "warn"}>
                {s.ok ? "ready" : "needs setup"}
              </Badge>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => void refresh()}>
            Re-check
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="mono text-xs uppercase tracking-wider">
            Env keys
          </div>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-[var(--fg-muted)]">
          <p>
            <span className="mono text-[var(--accent)]">GEMINI_API_KEY</span> —
            off-pitch synthesis (free Gemini tier)
          </p>
          <p>
            <span className="mono text-[var(--accent)]">API_FOOTBALL_KEY</span>{" "}
            — soccer form (free at api-football.com, 100 req/day)
          </p>
          <p>
            <span className="mono text-[var(--accent)]">ODDS_API_KEY</span> —
            optional NBA moneylines (free tier)
          </p>
          <p className="text-xs text-[var(--fg-dim)]">
            PrizePicks + Polymarket + ESPN need no keys. If PrizePicks 403s from
            this host, paste lines on the slate.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="mono text-xs uppercase tracking-wider">Cache</div>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-[var(--fg-muted)]">
            Responses are cached under <span className="mono">.cache/</span> to
            stretch free quotas.
          </p>
          <Button variant="secondary" onClick={() => void clearCache()}>
            Clear server cache
          </Button>
          {message ? (
            <p className="text-xs text-[var(--good)]">{message}</p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="text-xs text-[var(--fg-dim)]">
          Formcast is a personal research toy. It will not make you money. Lines
          move, news is wrong, and free feeds break. Pass more than you play.
        </CardBody>
      </Card>
    </div>
  );
}