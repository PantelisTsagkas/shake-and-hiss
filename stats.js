"use strict";
// Pure statistics helpers for Shake & Hiss. No browser APIs, so they can be tested in Node.

/**
 * Simplified NIST SP 800-90B assessment of raw 8-bit symbols.
 * - Most Common Value (MCV) min-entropy estimate, with a 99% upper confidence bound.
 * - Repetition Count Test (RCT): fails if one symbol repeats too many times in a row.
 * Assumes samples are independent, so treat the result as an estimate, not a certificate.
 */
function assessEntropy(symbols, safetyFactor = 0.5) {
  const n = symbols.length;
  const counts = new Array(256).fill(0);
  for (const s of symbols) counts[s]++;
  const maxCount = Math.max(...counts);
  const hMcv = minEntropy(maxCount / n, n);

  // Predictor estimate (in the style of NIST's lag/Markov predictors): guess each symbol from
  // the one before it, using only what was seen earlier, then count correct guesses.
  // Catches smooth, predictable signals (like a TV in the room) that MCV misses, and
  // learning only from the past stops it overfitting chance patterns.
  const table = new Map();            // prev symbol -> { counts, best }
  const globalCounts = new Array(256).fill(0);
  let globalBest = 0, correct = 0;
  for (let i = 1; i < n; i++) {
    const prev = symbols[i - 1], cur = symbols[i];
    const row = table.get(prev);
    const guess = row ? row.best : globalBest;
    if (guess === cur) correct++;
    const r = row || { counts: new Array(256).fill(0), best: cur };
    r.counts[cur]++;
    if (r.counts[cur] > r.counts[r.best]) r.best = cur;
    if (!row) table.set(prev, r);
    globalCounts[cur]++;
    if (globalCounts[cur] > globalCounts[globalBest]) globalBest = cur;
  }
  const hMarkov = n > 1 ? minEntropy(correct / (n - 1), n - 1) : 0;

  // Like NIST, keep the lowest (most cautious) estimate.
  const hPerSample = Math.min(hMcv, hMarkov);

  let maxRun = 1, run = 1;
  for (let i = 1; i < n; i++) {
    run = symbols[i] === symbols[i - 1] ? run + 1 : 1;
    if (run > maxRun) maxRun = run;
  }
  // NIST cutoff with false-alarm rate 2^-20, based on the entropy we actually claim
  // (the credited share), as NIST bases it on the claimed entropy per sample.
  const hClaimed = hPerSample * safetyFactor;
  const rctCutoff = hClaimed > 0 ? 1 + Math.ceil(20 / hClaimed) : Infinity;
  const distinct = counts.filter((c) => c > 0).length;

  return {
    n, counts, distinct, hPerSample, hMcv, hMarkov,
    totalBits: hPerSample * n,
    maxRun, rctCutoff,
    rctPassed: hPerSample > 0 && maxRun < rctCutoff,
  };
}

/** Min-entropy from a probability of guessing right, using its 99% upper confidence bound. */
function minEntropy(pHat, n) {
  const pUpper = Math.min(1, pHat + 2.576 * Math.sqrt((pHat * (1 - pHat)) / Math.max(1, n - 1)));
  return pUpper >= 1 ? 0 : -Math.log2(pUpper);
}

/** Credit only half of the estimate (safety margin), capped at the seed size. */
function creditedBits(totalBits, safetyFactor = 0.5, cap = 256) {
  return Math.max(0, Math.min(cap, Math.floor(totalBits * safetyFactor)));
}

/** Chi-square statistic for dice rolls (values 0..5). */
function chiSquareDice(rolls) {
  const obs = new Array(6).fill(0);
  for (const r of rolls) obs[r]++;
  const expected = rolls.length / 6;
  const chi2 = obs.reduce((sum, o) => sum + ((o - expected) ** 2) / expected, 0);
  // Critical values for 5 degrees of freedom.
  const verdict = chi2 < 11.07 ? "fair" : chi2 < 15.09 ? "suspicious" : "biased";
  return { obs, expected, chi2, verdict };
}

/** Dice straight from raw symbols, no hashing. Rejects 252..255 so mod 6 is unbiased. */
function rawDice(symbols, count) {
  const out = [];
  for (const s of symbols) {
    if (s < 252) out.push(s % 6);
    if (out.length >= count) break;
  }
  return out;
}

if (typeof module !== "undefined") {
  module.exports = { assessEntropy, creditedBits, chiSquareDice, rawDice };
}
