import { describe, it, expect } from 'vitest';
import { generatePlan, defaultPhases } from '../src/lib/plan-generator';
import type { PlannedSession, PhaseConfig } from '@steady/types';

// Minimal session helpers
function easy(distance = 8): PlannedSession {
  return { id: 't-easy', type: 'EASY', date: '2026-01-01', distance };
}

function interval(reps = 6): PlannedSession {
  return {
    id: 't-int',
    type: 'INTERVAL',
    date: '2026-01-01',
    reps,
    repDist: 800,
    recovery: '90s',
    warmup: { unit: 'km', value: 1.5 },
    cooldown: { unit: 'km', value: 1 },
  };
}

function tempo(): PlannedSession {
  return {
    id: 't-tempo',
    type: 'TEMPO',
    date: '2026-01-01',
    distance: 10,
    pace: '4:20',
    warmup: { unit: 'km', value: 2 },
    cooldown: { unit: 'km', value: 1.5 },
  };
}

function longRun(distance = 16): PlannedSession {
  return { id: 't-long', type: 'LONG', date: '2026-01-01', distance };
}

// A realistic 7-day template: Mon EASY, Tue INTERVAL, Wed REST, Thu TEMPO, Fri REST, Sat EASY, Sun LONG
const TEMPLATE: (PlannedSession | null)[] = [
  easy(8), interval(6), null, tempo(), null, easy(6), longRun(16),
];

describe('defaultPhases', () => {
  it('sums to totalWeeks', () => {
    for (const w of [8, 12, 16, 20, 24]) {
      const ph = defaultPhases(w);
      expect(ph.BASE + ph.BUILD + ph.RECOVERY + ph.PEAK + ph.TAPER).toBe(w);
    }
  });

  it('always has at least 1 BASE, 1 BUILD, 1 PEAK, 2 TAPER', () => {
    const ph = defaultPhases(8);
    expect(ph.BASE).toBeGreaterThanOrEqual(1);
    expect(ph.BUILD).toBeGreaterThanOrEqual(1);
    expect(ph.PEAK).toBeGreaterThanOrEqual(1);
    expect(ph.TAPER).toBeGreaterThanOrEqual(2);
  });

  it('RECOVERY defaults to 0', () => {
    expect(defaultPhases(16).RECOVERY).toBe(0);
  });
});

describe('generatePlan', () => {
  const phases: PhaseConfig = { BASE: 2, BUILD: 6, RECOVERY: 0, PEAK: 1, TAPER: 2 };

  it('returns correct number of weeks', () => {
    const plan = generatePlan(TEMPLATE, 11, 0, phases);
    expect(plan).toHaveLength(11);
  });

  it('assigns weekNumber 1-indexed', () => {
    const plan = generatePlan(TEMPLATE, 11, 0, phases);
    expect(plan[0].weekNumber).toBe(1);
    expect(plan[10].weekNumber).toBe(11);
  });

  it('phase order is BASE → BUILD → PEAK → TAPER', () => {
    const plan = generatePlan(TEMPLATE, 11, 0, phases);
    const phaseSeq = plan.map((w) => w.phase);
    expect(phaseSeq.slice(0, 2)).toEqual(['BASE', 'BASE']);
    expect(phaseSeq.slice(2, 8)).toEqual(Array(6).fill('BUILD'));
    expect(phaseSeq[8]).toBe('PEAK');
    expect(phaseSeq.slice(9)).toEqual(['TAPER', 'TAPER']);
  });

  it('inserts RECOVERY weeks evenly within BUILD', () => {
    const withRecovery: PhaseConfig = { BASE: 1, BUILD: 6, RECOVERY: 2, PEAK: 1, TAPER: 2 };
    const plan = generatePlan(TEMPLATE, 12, 0, withRecovery);
    const phaseSeq = plan.map((w) => w.phase);

    // BASE=1, then BUILD+RECOVERY interleaved, then PEAK, TAPER
    expect(phaseSeq[0]).toBe('BASE');
    expect(phaseSeq[plan.length - 1]).toBe('TAPER');
    expect(phaseSeq[plan.length - 2]).toBe('TAPER');
    expect(phaseSeq[plan.length - 3]).toBe('PEAK');

    // Recovery weeks appear in the BUILD section (not at start or after PEAK)
    const buildSection = phaseSeq.slice(1, 9); // 8 weeks = 6 BUILD + 2 RECOVERY
    const recoveryCount = buildSection.filter((p) => p === 'RECOVERY').length;
    const buildCount = buildSection.filter((p) => p === 'BUILD').length;
    expect(recoveryCount).toBe(2);
    expect(buildCount).toBe(6);
    // Recovery comes after at least one BUILD week (not at position 0)
    expect(buildSection[0]).toBe('BUILD');
  });

  it('each week has same number of sessions as template', () => {
    const plan = generatePlan(TEMPLATE, 11, 0, phases);
    for (const week of plan) {
      expect(week.sessions).toHaveLength(7);
    }
  });

  it('REST days remain null', () => {
    const plan = generatePlan(TEMPLATE, 11, 0, phases);
    for (const week of plan) {
      // Template indices 2, 4 are REST/null
      expect(week.sessions[2]).toBeNull();
      expect(week.sessions[4]).toBeNull();
    }
  });

  it('strips warmup and cooldown from EASY and LONG template sessions', () => {
    const templateWithLegacyBookends: (PlannedSession | null)[] = [
      {
        ...easy(8),
        warmup: { unit: 'km', value: 1.5 },
        cooldown: { unit: 'km', value: 1 },
      },
      {
        ...longRun(16),
        warmup: { unit: 'km', value: 2 },
        cooldown: { unit: 'km', value: 1.5 },
      },
    ];

    const plan = generatePlan(templateWithLegacyBookends, 1, 0, {
      BASE: 1,
      BUILD: 0,
      RECOVERY: 0,
      PEAK: 0,
      TAPER: 0,
    });

    expect(plan[0].sessions[0]).not.toHaveProperty('warmup');
    expect(plan[0].sessions[0]).not.toHaveProperty('cooldown');
    expect(plan[0].sessions[1]).not.toHaveProperty('warmup');
    expect(plan[0].sessions[1]).not.toHaveProperty('cooldown');
    expect(plan[0].plannedKm).toBe(24);
  });

  it('computes plannedKm for each week', () => {
    const plan = generatePlan(TEMPLATE, 11, 0, phases);
    for (const week of plan) {
      expect(typeof week.plannedKm).toBe('number');
      expect(week.plannedKm).toBeGreaterThan(0);
    }
  });
});

describe('progressive overload', () => {
  const phases: PhaseConfig = { BASE: 0, BUILD: 6, RECOVERY: 0, PEAK: 0, TAPER: 0 };

  it('applies progression every 2 weeks to EASY distance', () => {
    const tmpl: (PlannedSession | null)[] = [easy(10)];
    const plan = generatePlan(tmpl, 6, 7, phases);

    // Week 1 (w=0, prog=0): factor = 1.07^0 = 1 → 10
    expect(plan[0].sessions[0]!.distance).toBe(10);
    // Week 2 (w=1, prog=0): factor = 1.07^0 = 1 → 10
    expect(plan[1].sessions[0]!.distance).toBe(10);
    // Week 3 (w=2, prog=1): factor = 1.07^1 = 1.07 → round(10.7) = 11
    expect(plan[2].sessions[0]!.distance).toBe(11);
    // Week 5 (w=4, prog=2): factor = 1.07^2 = 1.1449 → round(11.449) = 11
    expect(plan[4].sessions[0]!.distance).toBe(11);
  });

  it('applies progression to INTERVAL reps', () => {
    const tmpl: (PlannedSession | null)[] = [interval(6)];
    const plan = generatePlan(tmpl, 6, 7, phases);

    expect(plan[0].sessions[0]!.reps).toBe(6); // factor=1
    // Week 3 (prog=1): 6 * 1.07 = 6.42 → 6
    expect(plan[2].sessions[0]!.reps).toBe(6);
    // Week 5 (prog=2): 6 * 1.1449 = 6.87 → 7
    expect(plan[4].sessions[0]!.reps).toBe(7);
  });

  it('caps INTERVAL reps at 20', () => {
    const tmpl: (PlannedSession | null)[] = [interval(18)];
    const plan = generatePlan(tmpl, 10, 10, { BASE: 0, BUILD: 10, RECOVERY: 0, PEAK: 0, TAPER: 0 });

    for (const week of plan) {
      expect(week.sessions[0]!.reps).toBeLessThanOrEqual(20);
    }
  });

  it('no progression when progressionPct is 0', () => {
    const tmpl: (PlannedSession | null)[] = [easy(10)];
    const plan = generatePlan(tmpl, 4, 0, { BASE: 0, BUILD: 4, RECOVERY: 0, PEAK: 0, TAPER: 0 });

    for (const week of plan) {
      expect(week.sessions[0]!.distance).toBe(10);
    }
  });
});

describe('recovery deload', () => {
  it('reduces volume to 65% in RECOVERY weeks', () => {
    const phases: PhaseConfig = { BASE: 0, BUILD: 2, RECOVERY: 1, PEAK: 0, TAPER: 0 };
    const tmpl: (PlannedSession | null)[] = [easy(10)];
    const plan = generatePlan(tmpl, 3, 0, phases);

    const recoveryWeek = plan.find((w) => w.phase === 'RECOVERY');
    expect(recoveryWeek).toBeDefined();
    // 10 * 0.65 = 6.5 → round = 7, max(3,7) = 7
    expect(recoveryWeek!.sessions[0]!.distance).toBe(7);
  });

  it('floors recovery reps at 3', () => {
    const phases: PhaseConfig = { BASE: 0, BUILD: 1, RECOVERY: 1, PEAK: 0, TAPER: 0 };
    const tmpl: (PlannedSession | null)[] = [interval(3)];
    const plan = generatePlan(tmpl, 2, 0, phases);

    const recoveryWeek = plan.find((w) => w.phase === 'RECOVERY');
    // 3 * 0.65 = 1.95 → round = 2, max(3,2) = 3
    expect(recoveryWeek!.sessions[0]!.reps).toBe(3);
  });

  it('does not apply progression in RECOVERY weeks', () => {
    const phases: PhaseConfig = { BASE: 0, BUILD: 2, RECOVERY: 1, PEAK: 0, TAPER: 0 };
    const tmpl: (PlannedSession | null)[] = [easy(10)];
    const plan = generatePlan(tmpl, 3, 10, phases);

    const recoveryWeek = plan.find((w) => w.phase === 'RECOVERY');
    // Recovery applies 65% to original template, not progressed value
    expect(recoveryWeek!.sessions[0]!.distance).toBe(7);
  });
});

describe('taper scaling', () => {
  it('first taper week at 80%, second at 60%', () => {
    const phases: PhaseConfig = { BASE: 0, BUILD: 0, RECOVERY: 0, PEAK: 1, TAPER: 2 };
    const tmpl: (PlannedSession | null)[] = [easy(10)];
    const plan = generatePlan(tmpl, 3, 0, phases);

    // PEAK week keeps template
    expect(plan[0].sessions[0]!.distance).toBe(10);
    // Taper 1: 10 * 0.80 = 8
    expect(plan[1].sessions[0]!.distance).toBe(8);
    // Taper 2: 10 * 0.60 = 6
    expect(plan[2].sessions[0]!.distance).toBe(6);
  });

  it('taper floors distance at 3', () => {
    const phases: PhaseConfig = { BASE: 0, BUILD: 0, RECOVERY: 0, PEAK: 1, TAPER: 2 };
    const tmpl: (PlannedSession | null)[] = [easy(4)];
    const plan = generatePlan(tmpl, 3, 0, phases);

    // Taper 2: 4 * 0.60 = 2.4 → round = 2, max(3,2) = 3
    expect(plan[2].sessions[0]!.distance).toBe(3);
  });

  it('does not apply progression in TAPER weeks', () => {
    const phases: PhaseConfig = { BASE: 0, BUILD: 2, RECOVERY: 0, PEAK: 1, TAPER: 2 };
    const tmpl: (PlannedSession | null)[] = [easy(10)];
    const plan = generatePlan(tmpl, 5, 10, phases);

    const taperWeeks = plan.filter((w) => w.phase === 'TAPER');
    // Taper applies to the un-progressed template value
    expect(taperWeeks[0].sessions[0]!.distance).toBe(8); // 10 * 0.80
    expect(taperWeeks[1].sessions[0]!.distance).toBe(6); // 10 * 0.60
  });
});

describe('PEAK phase', () => {
  it('applies progression factor in PEAK weeks', () => {
    const phases: PhaseConfig = { BASE: 2, BUILD: 4, RECOVERY: 0, PEAK: 1, TAPER: 0 };
    const tmpl: (PlannedSession | null)[] = [easy(10)];
    const plan = generatePlan(tmpl, 7, 7, phases);

    const peakWeek = plan.find((w) => w.phase === 'PEAK')!;
    // PEAK is at w=6, prog=3 → factor = 1.07^3 ≈ 1.2250 → round(12.250) = 12
    expect(peakWeek.sessions[0]!.distance).toBe(12);
  });
});

describe('full plan integration', () => {
  it('generates a 16-week plan with default phases', () => {
    const plan = generatePlan(TEMPLATE, 16, 7);
    expect(plan).toHaveLength(16);

    const phases = plan.map((w) => w.phase);
    // Should start with BASE and end with TAPER
    expect(phases[0]).toBe('BASE');
    expect(phases[phases.length - 1]).toBe('TAPER');

    // Volume should generally increase then taper
    const lastTaperKm = plan[plan.length - 1].plannedKm;
    const midKm = plan[Math.floor(plan.length / 2)].plannedKm;
    expect(midKm).toBeGreaterThan(lastTaperKm);
  });
});
