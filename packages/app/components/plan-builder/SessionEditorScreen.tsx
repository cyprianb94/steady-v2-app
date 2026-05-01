import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  normalizeRunStructure,
  type PlannedSession,
  type SessionFormat,
  type TrainingPaceProfile,
} from '@steady/types';
import type { SessionEditorResult } from '../../features/plan-builder/session-editing';
import { C } from '../../constants/colours';
import { RunStructureEditor } from './RunStructureEditor';
import { SessionEditor } from './SessionEditor';

interface SessionEditorScreenProps {
  dayIndex: number;
  existing: Partial<PlannedSession> | null;
  trainingPaceProfile?: TrainingPaceProfile | null;
  onSave: (dayIndex: number, session: SessionEditorResult) => void;
  onClose: () => void;
}

export function SessionEditorScreen({
  dayIndex,
  existing,
  trainingPaceProfile = null,
  onSave,
  onClose,
}: SessionEditorScreenProps) {
  const insets = useSafeAreaInsets();
  const initialFormat: SessionFormat = existing?.format === 'structured' || normalizeRunStructure(existing?.runStructure)
    ? 'structured'
    : 'simple';
  const [format, setFormat] = React.useState<SessionFormat>(initialFormat);
  const [draft, setDraft] = React.useState<Partial<PlannedSession> | null>(existing);

  if (format === 'structured') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <RunStructureEditor
          dayIndex={dayIndex}
          session={draft ?? { type: 'EASY', format: 'structured' }}
          trainingPaceProfile={trainingPaceProfile}
          onSave={onSave}
          onClose={onClose}
          onChangeFormat={(nextFormat, session) => {
            setDraft(session);
            setFormat(nextFormat);
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <SessionEditor
        dayIndex={dayIndex}
        existing={draft}
        trainingPaceProfile={trainingPaceProfile}
        onSave={onSave}
        onClose={onClose}
        onChangeFormat={(nextFormat, session) => {
          setDraft({
            ...session,
            format: nextFormat,
          });
          setFormat(nextFormat);
        }}
        presentation="screen"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
});
