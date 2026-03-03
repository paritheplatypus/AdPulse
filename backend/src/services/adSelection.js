/**
 * AdPulse Selection Algorithm
 *
 * Selects the optimal next ad for a given session using a constraint-based
 * scoring approach. The algorithm enforces hard constraints (rules that must
 * not be violated) and soft constraints (preferences that influence scoring).
 *
 * Hard Constraints (disqualify an ad entirely):
 *   1. No consecutive repeat — the same ad cannot be served back-to-back
 *   2. Frequency cap — an ad cannot exceed its max_frequency_per_session
 *
 * Soft Constraints (influence weighted score):
 *   3. Recency penalty — recently shown ads receive a score penalty
 *   4. Category diversity — penalize ads from a category shown in last 2 slots
 *   5. Advertiser diversity — penalize ads from an advertiser shown in last 3 slots
 *   6. Base weight — ad-level weight configured per advertiser (priority bidding proxy)
 *
 * Score formula:
 *   score = baseWeight * recencyFactor * categoryFactor * advertiserFactor
 *
 * If all active ads are disqualified by hard constraints, the algorithm
 * relaxes the frequency cap constraint and retries (graceful degradation).
 */

const RECENCY_PENALTY_WINDOW = 4; // penalize ads shown in last N slots
const CATEGORY_DIVERSITY_WINDOW = 2;
const ADVERTISER_DIVERSITY_WINDOW = 3;
const RECENCY_PENALTY_FACTOR = 0.3;
const CATEGORY_PENALTY_FACTOR = 0.5;
const ADVERTISER_PENALTY_FACTOR = 0.6;

/**
 * @param {Array} ads - All active ads from the database
 * @param {Array} sessionHistory - Ordered array of ad objects served in this session (oldest first)
 * @returns {{ selected: Object|null, reason: string, candidateCount: number }}
 */
const selectNextAd = (ads, sessionHistory) => {
  if (!ads || ads.length === 0) {
    return { selected: null, reason: 'no_ads_available', candidateCount: 0 };
  }

  // Build frequency map for this session
  const frequencyMap = buildFrequencyMap(sessionHistory);

  // Attempt 1: Full constraints
  const result = runSelection(ads, sessionHistory, frequencyMap, false);
  if (result.selected) return result;

  // Graceful degradation: relax frequency cap
  const relaxedResult = runSelection(ads, sessionHistory, frequencyMap, true);
  if (relaxedResult.selected) {
    return { ...relaxedResult, reason: 'frequency_cap_relaxed' };
  }

  return { selected: null, reason: 'no_eligible_ads', candidateCount: 0 };
};

const runSelection = (ads, sessionHistory, frequencyMap, relaxFrequencyCap) => {
  const lastAd = sessionHistory[sessionHistory.length - 1] || null;
  const recentAds = sessionHistory.slice(-RECENCY_PENALTY_WINDOW);
  const recentCategories = sessionHistory.slice(-CATEGORY_DIVERSITY_WINDOW).map(a => a.category);
  const recentAdvertisers = sessionHistory.slice(-ADVERTISER_DIVERSITY_WINDOW).map(a => a.advertiser);

  const scoredCandidates = [];

  for (const ad of ads) {
    // Hard constraint 1: no consecutive repeat
    if (lastAd && ad.id === lastAd.id) continue;

    // Hard constraint 2: frequency cap (unless relaxed)
    if (!relaxFrequencyCap) {
      const timesShown = frequencyMap[ad.id] || 0;
      if (timesShown >= ad.max_frequency_per_session) continue;
    }

    // Compute soft score
    let score = ad.weight || 1.0;

    // Recency penalty
    const recentCount = recentAds.filter(a => a.id === ad.id).length;
    if (recentCount > 0) {
      score *= Math.pow(RECENCY_PENALTY_FACTOR, recentCount);
    }

    // Category diversity penalty
    if (recentCategories.includes(ad.category)) {
      score *= CATEGORY_PENALTY_FACTOR;
    }

    // Advertiser diversity penalty
    if (recentAdvertisers.includes(ad.advertiser)) {
      score *= ADVERTISER_PENALTY_FACTOR;
    }

    scoredCandidates.push({ ad, score });
  }

  if (scoredCandidates.length === 0) {
    return { selected: null, reason: 'no_eligible_ads', candidateCount: 0 };
  }

  // Weighted random selection from top candidates
  // This adds entropy to prevent deterministic cycling while still
  // favoring higher-scored candidates
  const selected = weightedRandomSelect(scoredCandidates);

  return {
    selected,
    reason: 'ok',
    candidateCount: scoredCandidates.length,
    score: scoredCandidates.find(c => c.ad.id === selected.id)?.score,
  };
};

/**
 * Weighted random selection — selects proportionally to score.
 * Avoids pure greedy selection to maintain diversity across sessions.
 */
const weightedRandomSelect = (scoredCandidates) => {
  const totalScore = scoredCandidates.reduce((sum, c) => sum + c.score, 0);
  let random = Math.random() * totalScore;

  for (const candidate of scoredCandidates) {
    random -= candidate.score;
    if (random <= 0) return candidate.ad;
  }

  return scoredCandidates[scoredCandidates.length - 1].ad;
};

const buildFrequencyMap = (sessionHistory) => {
  return sessionHistory.reduce((map, ad) => {
    map[ad.id] = (map[ad.id] || 0) + 1;
    return map;
  }, {});
};

/**
 * Computes a diversity score (0-1) for a session.
 * 1.0 = perfect diversity (no consecutive repeats, all unique advertisers)
 * 0.0 = all ads from same advertiser, many consecutive repeats
 */
const computeDiversityScore = (sessionHistory) => {
  if (sessionHistory.length < 2) return 1.0;

  let consecutiveRepeats = 0;
  const advertiserSet = new Set();

  for (let i = 0; i < sessionHistory.length; i++) {
    advertiserSet.add(sessionHistory[i].advertiser);
    if (i > 0 && sessionHistory[i].id === sessionHistory[i - 1].id) {
      consecutiveRepeats++;
    }
  }

  const repeatPenalty = consecutiveRepeats / (sessionHistory.length - 1);
  const advertiserDiversity = advertiserSet.size / sessionHistory.length;

  return Math.max(0, Math.min(1, (advertiserDiversity - repeatPenalty)));
};

module.exports = { selectNextAd, computeDiversityScore, buildFrequencyMap };
