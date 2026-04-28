import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QualitySummaryCard, type QualitySummaryMetric } from '../components/run/QualitySummaryCard';
import { C } from '../constants/colours';

const intervalMetrics: QualitySummaryMetric[] = [
  { kind: 'distance', label: 'work distance', value: '4.8 km', detail: '6 reps completed' },
  { kind: 'pace', label: 'rep pace', value: '4:05/km' },
  { kind: 'heartRate', label: 'avg bpm', value: '168' },
  { kind: 'count', label: 'reps', value: '6 / 6' },
];

const tempoMetrics: QualitySummaryMetric[] = [
  { kind: 'distance', label: 'tempo distance', value: '7.0 km' },
  { kind: 'pace', label: 'tempo pace', value: '4:28/km' },
  { kind: 'heartRate', label: 'avg bpm', value: '161' },
  { kind: 'duration', label: 'tempo time', value: '31:20' },
];

function styleFor(testId: string) {
  return screen.getByTestId(testId).style;
}

function rgb(hex: string): string {
  const raw = hex.replace('#', '');
  const red = Number.parseInt(raw.slice(0, 2), 16);
  const green = Number.parseInt(raw.slice(2, 4), 16);
  const blue = Number.parseInt(raw.slice(4, 6), 16);

  return `rgb(${red}, ${green}, ${blue})`;
}

describe('QualitySummaryCard', () => {
  it('renders an interval summary with session accent and metric-value colours kept separate', () => {
    render(
      <QualitySummaryCard
        sessionType="interval"
        metrics={intervalMetrics}
        targetLabel="Target 3:50-4:00/km"
        note="Whole-run average pace is context only for this session."
      />,
    );

    expect(screen.getByText('Interval summary')).toBeTruthy();
    expect(screen.getByText('Interval')).toBeTruthy();
    expect(screen.getByText('Target 3:50-4:00/km')).toBeTruthy();
    expect(screen.getByText('work distance')).toBeTruthy();
    expect(screen.getByText('4.8 km')).toBeTruthy();
    expect(screen.getByText('rep pace')).toBeTruthy();
    expect(screen.getByText('4:05/km')).toBeTruthy();
    expect(screen.getByText('avg bpm')).toBeTruthy();
    expect(screen.getByText('168')).toBeTruthy();
    expect(screen.getByText('reps')).toBeTruthy();
    expect(screen.getByText('6 / 6')).toBeTruthy();

    expect(styleFor('quality-summary-session-tag').borderColor).toBe(rgb(C.clay));
    expect(styleFor('quality-summary-value-distance').color).toBe(rgb(C.metricDistance));
    expect(styleFor('quality-summary-value-pace').color).toBe(rgb(C.metricPace));
    expect(styleFor('quality-summary-value-heartRate').color).toBe(rgb(C.metricHeartRate));
    expect(styleFor('quality-summary-value-count').color).toBe(rgb(C.ink));
    expect(screen.getByText('Whole-run average pace is context only for this session.')).toBeTruthy();
  });

  it('renders a tempo summary in the same shell with tempo accent and duration as time colour', () => {
    render(<QualitySummaryCard sessionType="tempo" metrics={tempoMetrics} />);

    expect(screen.getByText('Tempo summary')).toBeTruthy();
    expect(screen.getByText('Tempo')).toBeTruthy();
    expect(screen.getByText('tempo distance')).toBeTruthy();
    expect(screen.getByText('7.0 km')).toBeTruthy();
    expect(screen.getByText('tempo pace')).toBeTruthy();
    expect(screen.getByText('4:28/km')).toBeTruthy();
    expect(screen.getByText('avg bpm')).toBeTruthy();
    expect(screen.getByText('161')).toBeTruthy();
    expect(screen.getByText('tempo time')).toBeTruthy();
    expect(screen.getByText('31:20')).toBeTruthy();

    expect(styleFor('quality-summary-session-tag').borderColor).toBe(rgb(C.amber));
    expect(styleFor('quality-summary-value-duration').color).toBe(rgb(C.metricTime));
  });

  it('uses status colour only for judgement metrics', () => {
    render(
      <QualitySummaryCard
        sessionType="tempo"
        metrics={[
          { kind: 'pace', label: 'tempo pace', value: '4:28/km' },
          { kind: 'status', label: 'execution', value: 'On target', statusTone: 'completed' },
        ]}
      />,
    );

    expect(screen.getByText('On target')).toBeTruthy();
    expect(styleFor('quality-summary-value-pace').color).toBe(rgb(C.metricPace));
    expect(styleFor('quality-summary-value-status').color).toBe(rgb(C.statusConnected));
  });

  it('shows an honest neutral unavailable state without fake metric numbers', () => {
    render(
      <QualitySummaryCard
        sessionType="interval"
        available={false}
        metrics={intervalMetrics}
        unavailableMessage="This run is missing lap data, so Steady cannot summarise the interval set."
      />,
    );

    expect(screen.getByText('Summary unavailable')).toBeTruthy();
    expect(screen.getByText('This run is missing lap data, so Steady cannot summarise the interval set.')).toBeTruthy();
    expect(screen.queryByText('4.8 km')).toBeNull();
    expect(screen.queryByText('6 / 6')).toBeNull();
    expect(styleFor('quality-summary-session-tag').borderColor).toBe(rgb(C.clay));
  });
});
