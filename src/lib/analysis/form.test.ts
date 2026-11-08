import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GameLog } from "@/lib/types";
import {
  consecutiveHitStreak,
  lastFive,
  nextGameAfterStreak,
} from "./form";

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

describe("consecutiveHitStreak", () => {
  it("counts newest consecutive overs and resets on a miss", () => {
    const logs = [
      log(20, "n1"),
      log(20, "n2"),
      log(20, "n3"),
      log(0, "miss"),
      log(20, "old"),
    ];
    assert.equal(consecutiveHitStreak(logs, 10, "over"), 3);
  });

  it("tracks unders when side is under", () => {
    const logs = [log(2, "a"), log(1, "b"), log(20, "c")];
    assert.equal(consecutiveHitStreak(logs, 5, "under"), 2);
  });
});

describe("nextGameAfterStreak", () => {
  it("studies continuation after the current consecutive streak", () => {
    // Newest three overs. One historical next-game after a 3-streak (miss).
    const logs = [
      log(20, "now1"),
      log(20, "now2"),
      log(20, "now3"),
      log(0, "gap"),
      log(0, "after-miss"),
      log(20, "h1"),
      log(20, "h2"),
      log(20, "h3"),
      log(0, "tail"),
    ];
    const study = nextGameAfterStreak(logs, 10, "over");
    assert.equal(study.consecutive.currentStreak, 3);
    assert.equal(study.consecutive.nextGames, 1);
    assert.equal(study.consecutive.nextHits, 0);
    assert.equal(study.consecutive.thin, true);
    assert.match(study.consecutive.summary, /3-game over streak/);
    assert.match(study.consecutive.summary, /too few to lean on/);
  });

  it("marks continuation samples thin under 3 next games", () => {
    const logs = [
      log(20, "c1"),
      log(20, "c2"),
      log(20, "c3"),
      log(20, "c4"),
      log(0, "after"),
      log(20, "p1"),
      log(20, "p2"),
      log(20, "p3"),
      log(20, "p4"),
      log(0, "tail"),
    ];
    const study = nextGameAfterStreak(logs, 10, "over");
    assert.equal(study.consecutive.currentStreak, 4);
    assert.equal(study.consecutive.nextGames, 1);
    assert.equal(study.consecutive.thin, true);
  });

  it("keeps an L5 hit-count study as a secondary signal", () => {
    const logs = [
      log(20, "a"),
      log(0, "b"),
      log(20, "c"),
      log(20, "d"),
      log(20, "e"),
      log(0, "f"),
      log(20, "g"),
      log(20, "h"),
      log(20, "i"),
      log(20, "j"),
      log(0, "k"),
    ];
    const study = nextGameAfterStreak(logs, 10, "over");
    // Newest five: hit, miss, hit, hit, hit → 4/5, streak only 1
    assert.equal(study.consecutive.currentStreak, 1);
    assert.equal(study.lastFiveCount.currentPriorHits, 4);
    assert.match(study.lastFiveCount.summary, /L5 are 4\/5/);
    assert.match(study.summary, /over streak/);
    assert.match(study.summary, /L5 are 4\/5/);
  });
});
