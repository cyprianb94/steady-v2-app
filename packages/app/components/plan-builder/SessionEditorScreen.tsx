import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  normalizeRunStructure,
  resolveSessionFormat,
  sessionSupportsFormat,
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

interface FormatChangeContext {
  restoreStructuredDraft?: Partial<PlannedSession>;
  pendingStructureClear?: boolean;
  pendingStructureClearReason?: StructureClearReason;
}

type StructureClearReason = 'simple' | 'recovery' | 'rest';

function resolveInitialFormat(existing: Partial<PlannedSession> | null): SessionFormat {
  if (!existing?.type) {
    return 'simple';
  }

  return resolveSessionFormat({
    type: existing.type,
    format: existing.format,
    runStructure: existing.runStructure,
  });
}

function planNoteFrom(
  session: Partial<PlannedSession>,
  fallback: Partial<PlannedSession>,
): string | undefined {
  return Object.prototype.hasOwnProperty.call(session, 'planNote')
    ? session.planNote
    : fallback.planNote;
}

export function SessionEditorScreen({
  dayIndex,
  existing,
  trainingPaceProfile = null,
  onSave,
  onClose,
}: SessionEditorScreenProps) {
  const insets = useSafeAreaInsets();
  const initialFormat = resolveInitialFormat(existing);
  const [format, setFormat] = React.useState<SessionFormat>(initialFormat);
  const [draft, setDraft] = React.useState<Partial<PlannedSession> | null>(existing);
  const [structureClearReason, setStructureClearReason] = React.useState<StructureClearReason | null>(null);
  const structuredDraftRef = React.useRef<Partial<PlannedSession> | null>(
    initialFormat === 'structured' ? existing : null,
  );

  function handleChangeFormat(
    nextFormat: SessionFormat,
    session: Partial<PlannedSession>,
    context: FormatChangeContext = {},
  ) {
    if (nextFormat === 'structured') {
      const nextType = session.type ?? structuredDraftRef.current?.type ?? draft?.type ?? 'EASY';
      const reusableStructuredDraft = structuredDraftRef.current
        && sessionSupportsFormat(nextType, 'structured')
        && (structureClearReason || structuredDraftRef.current.type === nextType)
        ? structuredDraftRef.current
        : null;

      setDraft({
        ...(reusableStructuredDraft ?? session),
        type: nextType,
        format: 'structured',
        ...(reusableStructuredDraft
          ? { planNote: planNoteFrom(session, reusableStructuredDraft) }
          : null),
      });
      setFormat('structured');
      setStructureClearReason(null);
      return;
    }

    const restoreDraft = context.restoreStructuredDraft
      ?? (format === 'structured' ? draft : null);
    if (
      restoreDraft?.type
      && sessionSupportsFormat(restoreDraft.type, 'structured')
      && normalizeRunStructure(restoreDraft.runStructure)
    ) {
      structuredDraftRef.current = {
        ...restoreDraft,
        format: 'structured',
      };
    }

    setDraft({
      ...session,
      format: 'simple',
    });
    setFormat('simple');
    setStructureClearReason(
      context.pendingStructureClear
        ? context.pendingStructureClearReason ?? 'simple'
        : null,
    );
  }

  if (format === 'structured') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <RunStructureEditor
          dayIndex={dayIndex}
          session={draft ?? { type: 'EASY', format: 'structured' }}
          trainingPaceProfile={trainingPaceProfile}
          onSave={onSave}
          onClose={onClose}
          onChangeFormat={handleChangeFormat}
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
        onChangeFormat={handleChangeFormat}
        structureClearPending={Boolean(structureClearReason)}
        structureClearReason={structureClearReason}
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
