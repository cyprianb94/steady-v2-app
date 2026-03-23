import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { usePlan } from '../../hooks/usePlan';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { PHASE_COLOR } from '../../constants/phase-meta';
import { SESSION_TYPE } from '../../constants/session-types';
import { weekKm } from '../../lib/plan-helpers';
import type { PlanWeek, PhaseName, SessionType } from '@steady/types';

export default function BlockTab() {
  const { plan, loading, currentWeekIndex } = usePlan();

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No plan yet</Text>
        <Text style={styles.muted}>Build a plan from the Week tab to see the block view.</Text>
      </View>
    );
  }

  // Build phase segments for the strip
  const phases = buildPhaseSegments(plan.weeks, currentWeekIndex);
  const currentPhase = plan.weeks[currentWeekIndex]?.phase ?? 'BUILD';
  const maxKm = Math.max(...plan.weeks.map(weekKm), 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Race header */}
      <View style={styles.header}>
        <Text style={styles.label}>GOAL RACE</Text>
        <Text style={styles.raceTitle}>{plan.raceName}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.metaValue, { color: C.clay }]}>{plan.raceDate}</Text>
          <Text style={[styles.metaValue, { color: C.muted }]}>
            {plan.weeks.length - currentWeekIndex} weeks out
          </Text>
          <Text style={[styles.metaValue, { color: C.navy }]}>{plan.targetTime}</Text>
        </View>
      </View>

      {/* Phase strip */}
      <View style={styles.phaseSection}>
        <View style={styles.phaseStrip}>
          {phases.map((p, i) => (
            <View
              key={i}
              style={[
                styles.phaseSegment,
                {
                  flex: p.weeks,
                  backgroundColor: p.isCurrent ? PHASE_COLOR[p.name] : C.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.phaseLabel,
                  { color: p.isCurrent ? 'white' : C.muted },
                ]}
              >
                {p.name}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.phaseCaption}>
          {currentPhase} phase · Week {currentWeekIndex + 1} of {plan.weeks.length}
        </Text>
      </View>

      {/* Week rows */}
      {plan.weeks.map((week, i) => {
        const isCurrent = i === currentWeekIndex;
        const isPast = i < currentWeekIndex;
        const km = weekKm(week);

        return (
          <View
            key={week.weekNumber}
            style={[
              styles.weekRow,
              isCurrent && styles.weekRowCurrent,
              isPast && styles.weekRowPast,
            ]}
          >
            <View style={styles.weekLeft}>
              <Text
                style={[
                  styles.weekNum,
                  isCurrent && { color: C.clay, fontWeight: '700' },
                ]}
              >
                W{week.weekNumber}
              </Text>
              <Text style={styles.weekPhaseTag}>{week.phase}</Text>
            </View>

            {/* Session dots */}
            <View style={styles.dots}>
              {week.sessions.map((s, d) => {
                const type: SessionType = s?.type ?? 'REST';
                return (
                  <View
                    key={d}
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          isPast || isCurrent
                            ? SESSION_TYPE[type].color
                            : C.border,
                        opacity: !isPast && !isCurrent ? 0.4 : 1,
                      },
                    ]}
                  />
                );
              })}
            </View>

            {/* Volume */}
            <View style={styles.weekRight}>
              <Text style={[styles.weekKm, isCurrent && { color: C.clay }]}>
                {km}km
              </Text>
            </View>
          </View>
        );
      })}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// --- helpers ---

interface PhaseSegment {
  name: PhaseName;
  weeks: number;
  isCurrent: boolean;
}

function buildPhaseSegments(weeks: PlanWeek[], currentIdx: number): PhaseSegment[] {
  const segments: PhaseSegment[] = [];
  let prev: PhaseName | null = null;

  for (let i = 0; i < weeks.length; i++) {
    const phase = weeks[i].phase;
    if (phase === prev) {
      segments[segments.length - 1].weeks++;
    } else {
      segments.push({ name: phase, weeks: 1, isCurrent: false });
    }
    if (i === currentIdx) {
      segments[segments.length - 1].isCurrent = true;
    }
    prev = phase;
  }

  return segments;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  content: {
    padding: 18,
    paddingTop: 60,
  },
  centered: {
    flex: 1,
    backgroundColor: C.cream,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  // Header
  header: {
    marginBottom: 14,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  raceTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    color: C.ink,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  metaValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
  },

  // Phase strip
  phaseSection: {
    marginBottom: 18,
  },
  phaseStrip: {
    flexDirection: 'row',
    gap: 2,
    height: 26,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 5,
  },
  phaseSegment: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  phaseLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 8.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  phaseCaption: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },

  // Week rows
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  weekRowCurrent: {
    backgroundColor: C.surface,
    borderColor: `${C.clay}35`,
    borderWidth: 1.5,
  },
  weekRowPast: {
    borderColor: C.border,
  },
  weekLeft: {
    width: 38,
  },
  weekNum: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.muted,
  },
  weekPhaseTag: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: C.muted,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    gap: 3.5,
    alignItems: 'center',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  weekRight: {
    width: 50,
    alignItems: 'flex-end',
  },
  weekKm: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.ink,
  },

  // Empty/loading
  emptyTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 20,
    color: C.ink,
    marginBottom: 8,
  },
  muted: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
  },
});
