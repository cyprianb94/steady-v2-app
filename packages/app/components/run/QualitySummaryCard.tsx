import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

export type QualitySummarySessionType = 'interval' | 'tempo';

export type QualitySummaryMetricKind =
  | 'distance'
  | 'pace'
  | 'heartRate'
  | 'duration'
  | 'count'
  | 'status';

export type QualitySummaryStatusTone = 'completed' | 'varied' | 'caution' | 'neutral';

export interface QualitySummaryMetric {
  kind: QualitySummaryMetricKind;
  label: string;
  value?: string | null;
  detail?: string | null;
  statusTone?: QualitySummaryStatusTone;
}

export interface QualitySummaryCardProps {
  sessionType: QualitySummarySessionType;
  metrics: QualitySummaryMetric[];
  targetLabel?: string | null;
  note?: string | null;
  available?: boolean;
  unavailableTitle?: string;
  unavailableMessage?: string;
}

const SESSION_STYLES: Record<QualitySummarySessionType, { title: string }> = {
  interval: {
    title: 'Interval summary',
  },
  tempo: {
    title: 'Tempo summary',
  },
};

const METRIC_COLOURS: Record<QualitySummaryMetricKind, string> = {
  distance: C.metricDistance,
  pace: C.metricPace,
  heartRate: C.metricHeartRate,
  duration: C.metricTime,
  count: C.ink,
  status: C.ink,
};

const STATUS_COLOURS: Record<QualitySummaryStatusTone, string> = {
  completed: C.statusConnected,
  varied: C.amber,
  caution: C.clay,
  neutral: C.ink,
};

function metricValueColour(metric: QualitySummaryMetric): string {
  if (metric.kind === 'status' && metric.statusTone) {
    return STATUS_COLOURS[metric.statusTone];
  }

  return METRIC_COLOURS[metric.kind];
}

export function QualitySummaryCard({
  sessionType,
  metrics,
  targetLabel,
  note,
  available = true,
  unavailableTitle = 'Summary unavailable',
  unavailableMessage = 'There is not enough structured session data to summarise this run yet.',
}: QualitySummaryCardProps) {
  const sessionStyle = SESSION_STYLES[sessionType];

  return (
    <View
      accessibilityLabel={sessionStyle.title}
      style={styles.card}
      testID="quality-summary-card"
    >
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{sessionStyle.title}</Text>
          {targetLabel ? <Text style={styles.targetLabel}>{targetLabel}</Text> : null}
        </View>
      </View>

      {!available ? (
        <View style={styles.unavailable} testID="quality-summary-unavailable">
          <Text style={styles.unavailableTitle}>{unavailableTitle}</Text>
          <Text style={styles.unavailableMessage}>{unavailableMessage}</Text>
        </View>
      ) : (
        <View style={styles.metricGrid}>
          {metrics.map((metric) => {
            const unavailable = !metric.value;
            return (
              <View key={`${metric.kind}-${metric.label}`} style={styles.metricCell}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text
                  style={[
                    styles.metricValue,
                    { color: unavailable ? C.muted : metricValueColour(metric) },
                  ]}
                  testID={`quality-summary-value-${metric.kind}`}
                >
                  {metric.value ?? 'Unavailable'}
                </Text>
                {metric.detail ? <Text style={styles.metricDetail}>{metric.detail}</Text> : null}
              </View>
            );
          })}
        </View>
      )}
      {available && note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  title: {
    color: C.ink,
    fontFamily: FONTS.serifBold,
    fontSize: 20,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  targetLabel: {
    color: C.muted,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCell: {
    backgroundColor: C.cream,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 132,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  metricLabel: {
    color: C.muted,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 16,
  },
  metricDetail: {
    color: C.ink2,
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  unavailable: {
    backgroundColor: C.cream,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  unavailableTitle: {
    color: C.ink,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    marginBottom: 4,
  },
  unavailableMessage: {
    color: C.ink2,
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  note: {
    color: C.ink2,
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },
});
