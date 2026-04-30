import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PlannedSession, TrainingPaceProfile } from '@steady/types';
import { C } from '../../constants/colours';
import { RunStructureEditor } from './RunStructureEditor';
import { SessionEditor } from './SessionEditor';

interface SessionEditorScreenProps {
  dayIndex: number;
  existing: Partial<PlannedSession> | null;
  trainingPaceProfile?: TrainingPaceProfile | null;
  onSave: (dayIndex: number, session: Partial<PlannedSession> | null) => void;
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
  const [structureDraft, setStructureDraft] = React.useState<Partial<PlannedSession> | null>(null);

  if (structureDraft) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <RunStructureEditor
          dayIndex={dayIndex}
          session={structureDraft}
          onSave={onSave}
          onClose={() => setStructureDraft(null)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <SessionEditor
        dayIndex={dayIndex}
        existing={existing}
        trainingPaceProfile={trainingPaceProfile}
        onSave={onSave}
        onClose={onClose}
        onEditRunStructure={(_, session) => setStructureDraft(session)}
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
