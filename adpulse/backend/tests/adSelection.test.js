const { selectNextAd, computeDiversityScore, buildFrequencyMap } = require('../src/services/adSelection');

const mockAds = [
  { id: 'ad-1', title: 'Ad One', advertiser: 'Acme Corp', category: 'technology', duration_seconds: 30, max_frequency_per_session: 2, weight: 1.0 },
  { id: 'ad-2', title: 'Ad Two', advertiser: 'Globex', category: 'food_beverage', duration_seconds: 15, max_frequency_per_session: 3, weight: 1.0 },
  { id: 'ad-3', title: 'Ad Three', advertiser: 'Initech', category: 'automotive', duration_seconds: 30, max_frequency_per_session: 2, weight: 1.0 },
  { id: 'ad-4', title: 'Ad Four', advertiser: 'Umbrella', category: 'technology', duration_seconds: 30, max_frequency_per_session: 1, weight: 1.0 },
  { id: 'ad-5', title: 'Ad Five', advertiser: 'Acme Corp', category: 'retail', duration_seconds: 15, max_frequency_per_session: 2, weight: 1.0 },
];

describe('selectNextAd', () => {
  test('returns null when no ads are available', () => {
    const result = selectNextAd([], []);
    expect(result.selected).toBeNull();
    expect(result.reason).toBe('no_ads_available');
  });

  test('returns an ad when history is empty', () => {
    const result = selectNextAd(mockAds, []);
    expect(result.selected).not.toBeNull();
    expect(result.reason).toBe('ok');
  });

  test('never serves the same ad consecutively', () => {
    const history = [mockAds[0]];
    // Run many times to account for random selection
    for (let i = 0; i < 50; i++) {
      const result = selectNextAd(mockAds, history);
      expect(result.selected.id).not.toBe('ad-1');
    }
  });

  test('respects frequency cap', () => {
    // ad-4 has max_frequency_per_session = 1, already shown once
    const history = [mockAds[3]]; // ad-4 shown once
    const moreHistory = [...history, mockAds[0]]; // ad-1 shown next

    // Show ad-4 again... but frequency says max 1
    // So ad-4 should not appear after being shown once
    for (let i = 0; i < 30; i++) {
      const result = selectNextAd(mockAds, [...history, mockAds[0]]); // ad-1 was last
      expect(result.selected.id).not.toBe('ad-4');
    }
  });

  test('gracefully degrades when all ads hit frequency cap', () => {
    // History with every ad at max frequency — algorithm should relax cap
    const history = [
      mockAds[0], mockAds[1], mockAds[0], // ad-1 at max (2)
      mockAds[2], mockAds[3], mockAds[2], // ad-3 at max (2), ad-4 at max (1)
      mockAds[4], mockAds[4],             // ad-5 at max (2)
      mockAds[1], mockAds[1], mockAds[1], // ad-2 at max (3)
    ];
    const lastAd = mockAds[0]; // different from last in history
    const result = selectNextAd(mockAds, [...history, mockAds[2]]); // ad-3 was last
    // Should still return something (graceful degradation)
    expect(result.selected).not.toBeNull();
    expect(result.reason).toBe('frequency_cap_relaxed');
  });

  test('returns correct candidateCount', () => {
    const result = selectNextAd(mockAds, []);
    expect(result.candidateCount).toBe(mockAds.length);
  });

  test('candidateCount decreases when last ad is excluded', () => {
    const history = [mockAds[0]];
    const result = selectNextAd(mockAds, history);
    // ad-1 excluded (consecutive), so max candidates = 4
    expect(result.candidateCount).toBeLessThanOrEqual(mockAds.length - 1);
  });
});

describe('buildFrequencyMap', () => {
  test('correctly counts ad appearances', () => {
    const history = [mockAds[0], mockAds[1], mockAds[0], mockAds[2], mockAds[0]];
    const map = buildFrequencyMap(history);
    expect(map['ad-1']).toBe(3);
    expect(map['ad-2']).toBe(1);
    expect(map['ad-3']).toBe(1);
    expect(map['ad-4']).toBeUndefined();
  });

  test('returns empty map for empty history', () => {
    expect(buildFrequencyMap([])).toEqual({});
  });
});

describe('computeDiversityScore', () => {
  test('returns 1.0 for empty or single-item history', () => {
    expect(computeDiversityScore([])).toBe(1.0);
    expect(computeDiversityScore([mockAds[0]])).toBe(1.0);
  });

  test('returns lower score for low diversity sessions', () => {
    // All same advertiser, same ad repeated
    const lowDiversityHistory = [mockAds[0], mockAds[0], mockAds[0], mockAds[0]];
    const score = computeDiversityScore(lowDiversityHistory);
    expect(score).toBeLessThan(0.5);
  });

  test('returns higher score for high diversity sessions', () => {
    const highDiversityHistory = [mockAds[0], mockAds[1], mockAds[2], mockAds[3], mockAds[4]];
    const score = computeDiversityScore(highDiversityHistory);
    expect(score).toBeGreaterThan(0.5);
  });

  test('score is between 0 and 1', () => {
    const histories = [
      [mockAds[0], mockAds[0], mockAds[0]],
      [mockAds[0], mockAds[1], mockAds[2]],
      mockAds,
    ];
    histories.forEach(h => {
      const score = computeDiversityScore(h);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});
