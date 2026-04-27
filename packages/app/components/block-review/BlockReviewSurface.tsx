import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  BLOCK_REVIEW_PHASE_ORDER,
  type BlockReviewModel,
  type BlockReviewPhaseModel,
  type BlockReviewTab,
  type BlockReviewWeekModel,
  type PhaseName,
  type SessionType,
} from '@steady/types';
import { C } from '../../constants/colours';
import { PHASE_COLOR } from '../../constants/phase-meta';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { AnimatedProgressFill } from '../ui/AnimatedProgressFill';
import { SessionDot } from '../ui/SessionDot';

const TAB_ITEMS: { key: BlockReviewTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'phases', label: 'Phases' },
  { key: 'weeks', label: 'Weeks' },
];

const CHART_HEIGHT = 122;

type FormatDistance = (km: number) => string;

export interface BlockReviewOverloadControl {
  progressionPct: number | null;
  isCustomising?: boolean;
  customPct?: string;
  customOptions?: number[];
  onSelectProgression: (pct: number) => void;
  onStartCustom?: () => void;
  onCustomPctChange?: (pct: string) => void;
  onChangeProgression?: () => void;
}

export interface BlockReviewSurfaceProps {
  model: BlockReviewModel;
  activeTab: BlockReviewTab;
  onTabChange: (tab: BlockReviewTab) => void;
  overload?: BlockReviewOverloadControl | null;
  onWeekPress?: (week: BlockReviewWeekModel) => void;
  onEditStructure?: () => void;
  formatDistance?: FormatDistance;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function defaultFormatDistance(km: number): string {
  return `${Math.round(km)}km`;
}

function phaseLabel(phase: PhaseName): string {
  return `${phase.slice(0, 1)}${phase.slice(1).toLowerCase()}`;
}

function phaseBackground(phase: PhaseName): string {
  switch (phase) {
    case 'BASE':
      return C.navyBg;
    case 'BUILD':
      return C.clayBg;
    case 'RECOVERY':
      return `${PHASE_COLOR.RECOVERY}16`;
    case 'PEAK':
      return C.amberBg;
    case 'TAPER':
      return C.forestBg;
    default:
      return C.card;
  }
}

function pointColor(point: { phase: PhaseName; isStart?: boolean; isPeak?: boolean; isRace?: boolean }): string {
  if (point.isStart) return PHASE_COLOR.BASE;
  if (point.isPeak) return C.amber;
  if (point.isRace) return C.forest;
  return PHASE_COLOR[point.phase];
}

function sessionDotColor(type: SessionType): string {
  return type === 'REST' ? C.border : SESSION_TYPE[type].color;
}

export function getBlockReviewTabMotionDuration(reducedMotion: boolean): number {
  return reducedMotion ? 0 : 220;
}

export function BlockReviewSurface({
  model,
  activeTab,
  onTabChange,
  overload,
  onWeekPress,
  onEditStructure,
  formatDistance = defaultFormatDistance,
  style,
  testID = 'block-review-surface',
}: BlockReviewSurfaceProps) {
  return (
    <View style={[styles.surface, style]} testID={testID}>
      {activeTab === 'overview' ? (
        <>
          <BlockVolumeChart model={model} formatDistance={formatDistance} />
          {overload ? <BlockReviewOverloadCard control={overload} /> : null}
        </>
      ) : null}

      <BlockReviewTabControl activeTab={activeTab} onTabChange={onTabChange} />

      {activeTab === 'overview' ? (
        <BlockReviewOverview
          model={model}
          formatDistance={formatDistance}
          onWeekPress={onWeekPress}
        />
      ) : null}
      {activeTab === 'phases' ? (
        <BlockReviewPhases
          model={model}
          onEditStructure={onEditStructure}
        />
      ) : null}
      {activeTab === 'weeks' ? (
        <BlockReviewWeeks
          model={model}
          formatDistance={formatDistance}
          onWeekPress={onWeekPress}
        />
      ) : null}
    </View>
  );
}

interface BlockReviewTabControlProps {
  activeTab: BlockReviewTab;
  onTabChange: (tab: BlockReviewTab) => void;
}

export function BlockReviewTabControl({ activeTab, onTabChange }: BlockReviewTabControlProps) {
  const reducedMotion = useReducedMotion();
  const activeIndex = Math.max(0, TAB_ITEMS.findIndex((tab) => tab.key === activeTab));
  const animatedIndex = useRef(new Animated.Value(activeIndex)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    Animated.timing(animatedIndex, {
      toValue: activeIndex,
      duration: getBlockReviewTabMotionDuration(reducedMotion),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, animatedIndex, reducedMotion]);

  const tabWidth = trackWidth > 0 ? (trackWidth - 8) / TAB_ITEMS.length : 0;
  const translateX = useMemo(
    () => animatedIndex.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [0, tabWidth + 4, (tabWidth + 4) * 2],
      extrapolate: 'clamp',
    }),
    [animatedIndex, tabWidth],
  );

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      setTrackWidth(nextWidth);
    }
  }

  return (
    <View
      style={styles.tabs}
      onLayout={handleLayout}
      testID="block-review-tabs"
    >
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tabIndicator,
            {
              width: tabWidth,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}

      {TAB_ITEMS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onTabChange(tab.key)}
            style={styles.tabButton}
            testID={`block-review-tab-${tab.key}`}
          >
            {!tabWidth && isActive ? <View pointerEvents="none" style={styles.tabFallbackIndicator} /> : null}
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface BlockVolumeChartProps {
  model: BlockReviewModel;
  formatDistance: FormatDistance;
}

export function BlockVolumeChart({ model, formatDistance }: BlockVolumeChartProps) {
  const points = model.volume.points;

  return (
    <View style={[styles.card, styles.chartCard]} testID="block-review-volume-chart">
      <View style={styles.chartHead}>
        <View style={styles.chartTitleGroup}>
          <Text style={styles.chartTitle}>Weekly volume</Text>
          <Text style={styles.chartSubtitle}>Builds through the middle, then tapers.</Text>
        </View>
        <View style={styles.peakPill}>
          <Text style={styles.peakPillText}>
            {formatDistance(model.volume.stats.peakKm)} peak
          </Text>
        </View>
      </View>

      <View style={styles.chartFrame}>
        <View style={[styles.chartGridLine, { top: 20 }]} />
        <View style={[styles.chartGridLine, styles.chartGridLineDashed, { top: 58 }]} />
        <View style={[styles.chartGridLine, styles.chartGridLineDashed, { top: 96 }]} />
        <Text style={styles.chartAxisLabel}>km</Text>

        {points.slice(0, -1).map((point, index) => {
          const next = points[index + 1];
          const dx = Math.max((next.x - point.x) * 100, 1);
          const dy = (next.y - point.y) * CHART_HEIGHT;
          const angle = Math.atan2(dy, dx * 3.2) * (180 / Math.PI);
          return (
            <View
              key={`${point.weekNumber}-${next.weekNumber}`}
              pointerEvents="none"
              style={[
                styles.chartSegment,
                {
                  left: `${point.x * 100}%`,
                  top: point.y * CHART_HEIGHT,
                  width: `${dx}%`,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}

        {points.map((point) => (
          <View
            key={point.weekNumber}
            style={[
              styles.chartPoint,
              {
                left: `${point.x * 100}%`,
                top: point.y * CHART_HEIGHT,
                backgroundColor: pointColor(point),
              },
            ]}
          />
        ))}

        {points[0] ? <Text style={[styles.chartMarker, styles.chartMarkerStart]}>W{points[0].weekNumber}</Text> : null}
        {model.volume.stats.peakWeekNumber > 0 ? (
          <Text style={[styles.chartMarker, styles.chartMarkerPeak]}>W{model.volume.stats.peakWeekNumber}</Text>
        ) : null}
        {points.length > 0 ? <Text style={[styles.chartMarker, styles.chartMarkerRace]}>Race</Text> : null}
      </View>

      <View style={styles.statsGrid}>
        <VolumeStat label="Start" value={formatDistance(model.volume.stats.startKm)} />
        <VolumeStat label="Peak" value={formatDistance(model.volume.stats.peakKm)} />
        <VolumeStat label="Race" value={formatDistance(model.volume.stats.raceKm)} />
      </View>

      <BlockReviewPhaseStrip model={model} />
    </View>
  );
}

function VolumeStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function BlockReviewPhaseStrip({ model }: { model: BlockReviewModel }) {
  if (model.phaseSegments.length === 0) {
    return null;
  }

  return (
    <View style={styles.phaseStrip} testID="block-review-phase-strip">
      {model.phaseSegments.map((segment, index) => (
        <View
          key={`${segment.phase}-${segment.startWeekNumber}-${index}`}
          style={[
            styles.phaseStripSegment,
            {
              flex: segment.weekCount,
              backgroundColor: PHASE_COLOR[segment.phase],
              opacity: segment.isCurrent ? 1 : 0.92,
            },
          ]}
        />
      ))}
    </View>
  );
}

function BlockReviewOverview({
  model,
  formatDistance,
  onWeekPress,
}: {
  model: BlockReviewModel;
  formatDistance: FormatDistance;
  onWeekPress?: (week: BlockReviewWeekModel) => void;
}) {
  if (model.keyWeeks.length === 0) {
    return null;
  }

  return (
    <View style={styles.keyWeeks} testID="block-review-overview">
      {model.keyWeeks.map((week) => (
        <Pressable
          key={week.id}
          disabled={!onWeekPress}
          onPress={() => onWeekPress?.(week)}
          style={({ pressed }) => [
            styles.keyWeek,
            pressed && styles.pressed,
          ]}
          testID={`block-review-key-week-${week.weekNumber}`}
        >
          <Text style={styles.keyWeekNumber}>W{week.weekNumber}</Text>
          <View style={styles.keyWeekCopy}>
            <Text style={styles.keyWeekTitle}>{week.title}</Text>
            <Text style={styles.keyWeekDetail}>
              {formatDistance(week.plannedKm)} · {week.isPeakWeek ? 'Highest load' : phaseLabel(week.phase)}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function BlockReviewOverloadCard({ control }: { control: BlockReviewOverloadControl }) {
  const customOptions = control.customOptions ?? [5, 7, 10, 12, 15];
  const customPct = control.customPct ?? '7';
  const selectedPct = Number(customPct) || 7;

  if (control.progressionPct !== null && !control.isCustomising) {
    return (
      <View style={[styles.card, styles.overloadConfirmed]} testID="block-review-overload-confirmed">
        <View style={styles.overloadConfirmedLeft}>
          <Text style={styles.overloadCheck}>✓</Text>
          <Text style={styles.overloadConfirmedText}>
            {control.progressionPct === 0
              ? 'Flat plan.'
              : `+${control.progressionPct}% progression every 2 weeks.`}
          </Text>
        </View>
        {control.onChangeProgression ? (
          <Pressable onPress={control.onChangeProgression} testID="block-review-overload-change">
            <Text style={styles.overloadChange}>change</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.overloadCard]} testID="block-review-overload-card">
      <Text style={styles.overloadCopy}>
        <Text style={styles.overloadLead}>Steady</Text>
        {' — Add progressive overload? Volume builds automatically through build, then tapers.'}
      </Text>

      {control.isCustomising ? (
        <View style={styles.customOverload}>
          <View style={styles.customPctRow}>
            {customOptions.map((option) => {
              const value = String(option);
              const isSelected = customPct === value;
              return (
                <Pressable
                  key={option}
                  onPress={() => control.onCustomPctChange?.(value)}
                  style={[
                    styles.pctChip,
                    isSelected && styles.pctChipSelected,
                  ]}
                  testID={`block-review-overload-${option}`}
                >
                  <Text style={[styles.pctChipText, isSelected && styles.pctChipTextSelected]}>
                    {option}%
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => control.onSelectProgression(selectedPct)}
            style={styles.overloadPrimary}
            testID="block-review-overload-apply-custom"
          >
            <Text style={styles.overloadPrimaryText}>Apply {selectedPct}%</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.overloadButtons}>
          <Pressable
            onPress={() => control.onSelectProgression(7)}
            style={styles.overloadPrimary}
            testID="block-review-overload-accept"
          >
            <Text style={styles.overloadPrimaryText}>Yes, +7% / 2w</Text>
          </Pressable>
          <Pressable
            onPress={control.onStartCustom}
            style={styles.overloadSecondary}
            testID="block-review-overload-custom"
          >
            <Text style={styles.overloadSecondaryText}>Custom %</Text>
          </Pressable>
          <Pressable
            onPress={() => control.onSelectProgression(0)}
            style={styles.overloadSecondary}
            testID="block-review-overload-flat"
          >
            <Text style={[styles.overloadSecondaryText, styles.overloadMutedText]}>Keep flat</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function BlockReviewPhases({
  model,
  onEditStructure,
}: {
  model: BlockReviewModel;
  onEditStructure?: () => void;
}) {
  return (
    <View style={styles.phaseList} testID="block-review-phases">
      {model.phases.map((phase) => (
        <PhaseCard key={phase.phase} phase={phase} />
      ))}

      {model.structureLabel ? (
        <View style={styles.structureCard}>
          <View style={styles.structureCopy}>
            <Text style={styles.structureTitle}>Block structure</Text>
            <Text style={styles.structureValue}>{model.structureLabel}</Text>
          </View>
          {onEditStructure ? (
            <Pressable onPress={onEditStructure} testID="block-review-edit-structure">
              <Text style={styles.structureEdit}>Edit</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function PhaseCard({ phase }: { phase: BlockReviewPhaseModel }) {
  const color = PHASE_COLOR[phase.phase];

  return (
    <View style={[styles.card, styles.phaseCard]} testID={`block-review-phase-${phase.phase.toLowerCase()}`}>
      <View style={styles.phaseCardTop}>
        <View style={styles.phaseCardNameGroup}>
          <View style={[styles.phaseDot, { backgroundColor: color }]} />
          <Text style={styles.phaseCardName}>{phaseLabel(phase.phase)}</Text>
        </View>
        <Text style={styles.phaseRange}>{phase.rangeLabel}</Text>
      </View>
      <Text style={styles.phaseSummary}>{phase.summary}</Text>
      <View style={styles.phaseSessionDots}>
        {phase.sessionTypes.map((type, index) => (
          <SessionDot key={`${phase.phase}-${index}`} type={type} size={11} />
        ))}
      </View>
    </View>
  );
}

function BlockReviewWeeks({
  model,
  formatDistance,
  onWeekPress,
}: {
  model: BlockReviewModel;
  formatDistance: FormatDistance;
  onWeekPress?: (week: BlockReviewWeekModel) => void;
}) {
  return (
    <View style={styles.weekList} testID="block-review-weeks">
      {model.weeks.map((week) => (
        <BlockReviewWeekRow
          key={week.id}
          week={week}
          formatDistance={formatDistance}
          onPress={onWeekPress}
        />
      ))}
    </View>
  );
}

export function BlockReviewWeekRow({
  week,
  formatDistance = defaultFormatDistance,
  onPress,
}: {
  week: BlockReviewWeekModel;
  formatDistance?: FormatDistance;
  onPress?: (week: BlockReviewWeekModel) => void;
}) {
  const color = PHASE_COLOR[week.phase];
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => onPress?.(week)}
      style={({ pressed }) => [
        styles.weekRow,
        week.isCurrentWeek && styles.weekRowCurrent,
        pressed && styles.pressed,
      ]}
      testID={`block-review-week-${week.weekNumber}`}
    >
      <View style={styles.weekRowTop}>
        <Text style={[styles.weekNumber, week.isCurrentWeek && styles.weekNumberCurrent]}>
          W{week.weekNumber}
        </Text>
        <View style={styles.runDots}>
          {week.sessionTypes.map((type, index) => (
            <View
              key={`${week.weekNumber}-${index}`}
              style={[
                styles.runDot,
                { backgroundColor: sessionDotColor(type) },
              ]}
            />
          ))}
        </View>
        <View style={styles.weekRight}>
          <Text style={styles.weekKm}>{formatDistance(week.plannedKm)}</Text>
          <View style={[styles.phaseTag, { backgroundColor: phaseBackground(week.phase) }]}>
            <Text style={[styles.phaseTagText, { color }]}>{phaseLabel(week.phase)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.weekBar}>
        <AnimatedProgressFill
          progress={week.volumeRatio}
          fillStyle={[styles.weekBarFill, { backgroundColor: color }]}
        />
      </View>
    </Pressable>
  );
}

export function BlockReviewPhaseOrderLegend() {
  return (
    <View style={styles.phaseLegend}>
      {BLOCK_REVIEW_PHASE_ORDER.map((phase) => (
        <View key={phase} style={styles.phaseLegendItem}>
          <View style={[styles.phaseLegendDot, { backgroundColor: PHASE_COLOR[phase] }]} />
          <Text style={styles.phaseLegendText}>{phaseLabel(phase)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    gap: 13,
  },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
  },
  chartCard: {
    padding: 16,
    paddingBottom: 14,
  },
  chartHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  chartTitleGroup: {
    flex: 1,
  },
  chartTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 17,
    color: C.ink,
  },
  chartSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    marginTop: 3,
  },
  peakPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: C.amberBg,
  },
  peakPillText: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: C.amber,
  },
  chartFrame: {
    height: CHART_HEIGHT,
    marginTop: 12,
    position: 'relative',
  },
  chartGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: C.border,
  },
  chartGridLineDashed: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: C.border,
    backgroundColor: 'transparent',
  },
  chartAxisLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: C.muted,
  },
  chartSegment: {
    position: 'absolute',
    height: 4,
    borderRadius: 999,
    backgroundColor: C.clay,
  },
  chartPoint: {
    position: 'absolute',
    width: 10,
    height: 10,
    marginLeft: -5,
    marginTop: -5,
    borderRadius: 5,
  },
  chartMarker: {
    position: 'absolute',
    bottom: 0,
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: C.muted,
  },
  chartMarkerStart: {
    left: 0,
  },
  chartMarkerPeak: {
    left: '63%',
  },
  chartMarkerRace: {
    right: 0,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 13,
  },
  statBox: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  statLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    color: C.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 16,
    color: C.ink,
    marginTop: 6,
  },
  phaseStrip: {
    flexDirection: 'row',
    gap: 3,
    height: 11,
    marginTop: 15,
    borderRadius: 7,
    overflow: 'hidden',
  },
  phaseStripSegment: {
    height: '100%',
  },
  overloadCard: {
    padding: 14,
    backgroundColor: C.amberBg,
    borderColor: `${C.amber}30`,
  },
  overloadCopy: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    color: C.ink2,
  },
  overloadLead: {
    fontFamily: FONTS.sansSemiBold,
    color: C.amber,
  },
  overloadButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  overloadPrimary: {
    minHeight: 37,
    paddingHorizontal: 12,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.amber,
    backgroundColor: C.amber,
  },
  overloadPrimaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.surface,
  },
  overloadSecondary: {
    minHeight: 37,
    paddingHorizontal: 12,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  overloadSecondaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  overloadMutedText: {
    color: C.muted,
  },
  overloadConfirmed: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderColor: `${C.forest}25`,
    backgroundColor: C.forestBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  overloadConfirmedLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overloadCheck: {
    color: C.forest,
    fontSize: 14,
  },
  overloadConfirmedText: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 12.5,
    color: C.forest,
  },
  overloadChange: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  customOverload: {
    marginTop: 12,
    gap: 10,
  },
  customPctRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  pctChip: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  pctChipSelected: {
    borderColor: C.amber,
    backgroundColor: `${C.amber}18`,
  },
  pctChipText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: C.muted,
  },
  pctChipTextSelected: {
    fontFamily: FONTS.monoBold,
    color: C.amber,
  },
  tabs: {
    position: 'relative',
    height: 42,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 22,
    overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 18,
    backgroundColor: C.surface,
  },
  tabButton: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    overflow: 'hidden',
  },
  tabFallbackIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: C.surface,
    borderRadius: 18,
  },
  tabText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.muted,
  },
  tabTextActive: {
    color: C.ink,
  },
  keyWeeks: {
    gap: 8,
  },
  keyWeek: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
  },
  keyWeekNumber: {
    width: 40,
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.muted,
  },
  keyWeekCopy: {
    flex: 1,
    minWidth: 0,
  },
  keyWeekTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
  },
  keyWeekDetail: {
    fontFamily: FONTS.sans,
    fontSize: 10.5,
    color: C.muted,
    marginTop: 2,
  },
  chevron: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: C.muted,
  },
  phaseList: {
    gap: 11,
  },
  phaseCard: {
    padding: 15,
  },
  phaseCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  phaseCardNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phaseDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
  },
  phaseCardName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    letterSpacing: 2.1,
    textTransform: 'uppercase',
    color: C.ink,
  },
  phaseRange: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: C.muted,
  },
  phaseSummary: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 18,
    color: C.ink2,
    marginTop: 9,
  },
  phaseSessionDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  structureCard: {
    minHeight: 62,
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
  },
  structureCopy: {
    flex: 1,
  },
  structureTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
  },
  structureValue: {
    fontFamily: FONTS.sans,
    fontSize: 10.5,
    color: C.muted,
    marginTop: 2,
  },
  structureEdit: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.clay,
  },
  weekList: {
    gap: 8,
  },
  weekRow: {
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
  },
  weekRowCurrent: {
    borderColor: `${C.clay}45`,
    backgroundColor: C.clayBg,
  },
  weekRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weekNumber: {
    width: 32,
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.muted,
  },
  weekNumberCurrent: {
    color: C.clay,
  },
  runDots: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  runDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  weekRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekKm: {
    fontFamily: FONTS.monoBold,
    fontSize: 14,
    color: C.ink,
  },
  phaseTag: {
    minHeight: 25,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseTagText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  weekBar: {
    height: 3,
    marginTop: 10,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: C.border,
  },
  weekBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  phaseLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  phaseLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  phaseLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseLegendText: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
  },
  pressed: {
    opacity: 0.78,
  },
});
