import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GameLog } from "@/lib/types";
import { lastFive, nextGameAfterStreak } from "./form";

function log(value: number, date: string): GameLog {
  return { date, opponent: "OPP", home: true, value };
}

describe("lastFive", () => {
  it("reads the newest five games, not the oldest five", () => {
    const logs = [
      log(1, "2026-04-05"),
      log(1, "2026-04-04"),
      log(1, "2026-04-03"),
      log(1, "2026-04-02"),
      log(1, "2026-04-01"),
      log(100, "2026-03-05"),
      log(100, "2026-03-04"),
      log(100, "2026-03-03"),
      log(100, "2026-03-02"),
      log(100, "2026-03-01"),
    ];
    const strip = lastFive(logs, 50, "over");
    assert.equal(strip.hits, 0);
    assert.equal(strip.sample, 5);
    assert.deepEqual(
      strip.games.map((game) => game.date),
      ["2026-04-05", "2026-04-04", "2026-04-03", "2026-04-02", "2026-04-01"],
    );
  });

  it("counts a push as a miss, matching L10", () => {
    const strip = lastFive([log(10, "2026-04-01")], 10, "over");
    assert.equal(strip.hits, 0);
    assert.equal(strip.games[0]?.hit, false);
  });
});

describe("nextGameAfterStreak", () => {
  it("treats the five older games as the setup and the newer game as the result", () => {
    // Newest first. logs[0] is a miss played after five hits.
    const logs = [
      log(0, "2026-04-11"),
      log(20, "2026-04-10"),
      log(20, "2026-04-09"),
      log(20, "2026-04-08"),
      log(20, "2026-04-07"),
      log(20, "2026-04-06"),
      log(0, "2026-04-05"),
      log(0, "2026-04-04"),
      log(0, "2026-04-03"),
      log(0, "2026-04-02"),
      log(0, "2026-04-01"),
    ];
    const study = nextGameAfterStreak(logs, 10, "over");
    // Current last 5 are 0,20,20,20,20 — four hits, not the historical 5/5 bucket.
    assert.equal(study.currentPriorHits, 4);
    const afterFive = study.buckets.find((bucket) => bucket.priorHits === 5);
    assert.ok(afterFive);
    assert.equal(afterFive.nextGames, 1);
    assert.equal(afterFive.nextHits, 0);
    assert.equal(afterFive.thin, true);
    assert.match(study.summary, /too few to lean on/);
  });

  it("calls a bucket thin until three next games exist", () => {
    const oneNext = nextGameAfterStreak(
      [
        log(20, "2026-04-06"),
        log(20, "2026-04-05"),
        log(20, "2026-04-04"),
        log(20, "2026-04-03"),
        log(20, "2026-04-02"),
        log(20, "2026-04-01"),
        log(0, "2026-03-31"),
      ],
      10,
      "over",
    );
    assert.equal(oneNext.currentPriorHits, 5);
    assert.equal(oneNext.buckets[5]?.nextGames, 1);
    assert.equal(oneNext.buckets[5]?.thin, true);
    assert.match(oneNext.summary, /too few to lean on/);

    // Newest first. A hit that follows five hits also makes the game in front
    // of it a 5/5 window, so only the newest game is a clean hit-outcome.
    // Two later misses each sit on their own five hits.
    const threeNext = nextGameAfterStreak(
      [
        log(20, "n1"),
        log(20, "h1"),
        log(20, "h2"),
        log(20, "h3"),
        log(20, "h4"),
        log(20, "h5"),
        log(0, "gap1"),
        log(0, "m2"),
        log(20, "a1"),
        log(20, "a2"),
        log(20, "a3"),
        log(20, "a4"),
        log(20, "a5"),
        log(0, "gap2"),
        log(0, "m3"),
        log(20, "b1"),
        log(20, "b2"),
        log(20, "b3"),
        log(20, "b4"),
        log(20, "b5"),
        log(0, "tail"),
      ],
      10,
      "over",
    );
    assert.equal(threeNext.currentPriorHits, 5);
    assert.equal(threeNext.buckets[5]?.nextGames, 3);
    assert.equal(threeNext.buckets[5]?.nextHits, 1);
    assert.equal(threeNext.buckets[5]?.thin, false);
    assert.match(threeNext.summary, /Last 5 are 5\/5/);
    assert.match(threeNext.summary, /hit 1 of 3/);
  });
});
