/* ═══════════════════════════════════════════════
   MATH & DISTRIBUTION HELPERS
═══════════════════════════════════════════════ */

/** Round to 2 decimal places */
function round2(n) { return Math.round(n * 100) / 100; }

/** Escape text for safe HTML insertion */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Seeded pseudo-random generator — values in [0, 1) */
function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Distribute `total` across `count` months with a DECLINING pattern.
 *
 * Strategy:
 * - Generate weights that naturally decrease from index 0 to count-1.
 * - Add small random noise (controlled by variance) so no two values are equal
 *   and the decline is not mechanical/uniform.
 * - Sort descending to guarantee declining order.
 * - Fix rounding drift on last element.
 *
 * @param {number} total
 * @param {number} count
 * @param {number} variance  1–5  (controls noise amount)
 * @param {number} seedVal
 * @returns {number[]}  always strictly decreasing (no two equal)
 */
function distributeAmount(total, count, variance, seedVal) {
  if (count <= 0) return [];
  if (count === 1) return [round2(total)];

  // noise spread per variance level
  const spread = [0, 0.04, 0.09, 0.15, 0.22, 0.30][variance] || 0.15;
  const rand   = seededRand(seedVal);

  // Build declining base weights:
  // weight[i] = (count - i) + noise  →  naturally larger for early months
  // We use a geometric-like decay so mid months aren't all similar
  let weights = [];
  for (let i = 0; i < count; i++) {
    // base: exponential decay factor
    const base  = Math.pow((count - i) / count, 0.6) * count;
    // noise: always positive so we never accidentally flip order before sort
    const noise = (rand() * spread * 2 - spread) * base * 0.5;
    weights.push(Math.max(0.01, base + noise));
  }

  // Sort descending — guarantees monotonic decline
  weights.sort((a, b) => b - a);

  // Make strictly decreasing: if any adjacent pair is equal, nudge the later one down
  for (let i = 1; i < weights.length; i++) {
    if (weights[i] >= weights[i - 1]) {
      weights[i] = weights[i - 1] * (1 - 0.001 - rand() * 0.005);
    }
  }

  const tw      = weights.reduce((a, b) => a + b, 0);
  const rounded = weights.map(w => round2((w / tw) * total));

  // Fix rounding drift
  const drift = round2(total - rounded.reduce((a, b) => a + b, 0));
  rounded[rounded.length - 1] = round2(rounded[rounded.length - 1] + drift);

  // Final safety: ensure strictly decreasing after rounding
  // If rounding made two values equal, adjust by 0.01
  for (let i = 1; i < rounded.length; i++) {
    if (rounded[i] >= rounded[i - 1]) {
      rounded[i] = round2(rounded[i - 1] - 0.01);
    }
  }

  return rounded;
}

/**
 * Distribute total across N months where the FIRST month is controlled
 * by absolute amount min/max.
 *
 * Cap rules:
 *  - fixedFirst provided & ≤ maxAmt         → use as-is
 *  - fixedFirst > maxAmt (cap enabled)       → clamp to maxAmt (with tiny nudge for realism)
 *  - fixedFirst = null/0 & cap enabled       → pick random value in [minAmt, maxAmt]
 *  - fixedFirst < minAmt                     → leave as-is (below floor is acceptable)
 *  - cap disabled                            → use fixedFirst as-is or skip
 *
 * @param {number}      total
 * @param {number}      count
 * @param {number}      variance
 * @param {number}      seedVal
 * @param {number|null} fixedFirst
 * @param {number}      minAmt       0 = no floor
 * @param {number}      maxAmt       Infinity = no ceiling
 * @param {boolean}     capEnabled
 * @returns {{ amounts: number[], firstAdjusted: boolean }}
 */
function distributeWithCapAmt(total, count, variance, seedVal, fixedFirst, minAmt, maxAmt, capEnabled) {
  let firstAdjusted = false;
  let first = (fixedFirst === null || fixedFirst === undefined) ? null : fixedFirst;

  // Only apply cap logic if cap is enabled AND at least one bound is actually set
  const hasMin = minAmt > 0;
  const hasMax = isFinite(maxAmt) && maxAmt > 0;

  if (capEnabled && count > 1 && (hasMin || hasMax)) {
    const effectiveMax = hasMax ? Math.min(maxAmt, total * 0.99) : total * 0.99;
    const effectiveMin = hasMin ? Math.min(minAmt, effectiveMax) : 0;

    if (first === null || first === 0) {
      // No manual value → pick random inside [min, max]
      const rand = seededRand(seedVal ^ 0xABCD);
      first = round2(effectiveMin + rand() * (effectiveMax - effectiveMin));
    } else if (hasMax && first > effectiveMax) {
      // Exceeds ceiling → clamp with tiny random nudge so it's not mechanically exact
      const range = effectiveMax - effectiveMin;
      const rand  = seededRand(seedVal ^ 0x1234);
      const nudge = range > 0 ? rand() * range * 0.08 : 0;
      first = round2(Math.max(effectiveMin, effectiveMax - nudge));
      firstAdjusted = true;
    }
    // first < minAmt → leave as-is per spec
  }

  let amounts;
  if (first !== null && count > 1) {
    const remaining = round2(total - first);
    if (remaining <= 0) {
      // Edge case: first >= total → just put everything in first month
      amounts = [total, ...Array(count - 1).fill(0)];
    } else {
      const rest = distributeAmount(remaining, count - 1, variance, seedVal);
      amounts    = [first, ...rest];
    }
  } else if (first !== null && count === 1) {
    amounts = [total];
  } else {
    amounts = distributeAmount(total, count, variance, seedVal);
  }

  return { amounts, firstAdjusted };
}

/** Build ordered month-index array (1–12) starting from `start` */
function buildMonths(start, count) {
  return Array.from({ length: count }, (_, i) => ((start - 1 + i) % 12) + 1);
}

/** Format number with thousands separator, 2 decimals */
function fmt(n) {
  return (typeof n === 'number' ? n : 0)
    .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format percentage (0–1) as "X.XX%" */
function fmtPct(v) {
  return (v * 100).toFixed(2) + '%';
}
