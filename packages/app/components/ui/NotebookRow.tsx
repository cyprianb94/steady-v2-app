import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

interface NotebookRowProps {
  label: string;
  trailing?: ReactNode;
  onTap?: () => void;
  expanded?: boolean;
  editor?: ReactNode;
  first?: boolean;
  disabled?: boolean;
  accentColor?: string;
  children: ReactNode;
}

export function NotebookRow({
  label,
  trailing,
  onTap,
  expanded = false,
  editor,
  first = false,
  disabled = false,
  accentColor,
  children,
}: NotebookRowProps) {
  const interactive = Boolean(onTap) && !disabled;
  const rowContent = (
    <>
      <View style={styles.labelCol}>
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>

      <View style={styles.content}>{children}</View>

      <View style={styles.chevronRail}>
        {interactive ? (
          <Text
            style={[
              styles.chevron,
              expanded && styles.chevronExpanded,
              expanded && accentColor ? { color: accentColor } : null,
            ]}
          >
            ›
          </Text>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={[styles.wrapper, !first && styles.borderTop]}>
      {interactive ? (
        <Pressable onPress={onTap} style={[styles.row, disabled && styles.disabled]}>
          {rowContent}
        </Pressable>
      ) : (
        <View style={[styles.row, disabled && styles.disabled]}>
          {rowContent}
        </View>
      )}

      {editor ? <View style={styles.editor}>{editor}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  disabled: {
    opacity: 0.55,
  },
  labelCol: {
    width: 120,
    gap: 6,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: C.muted,
  },
  labelDisabled: {
    color: C.muted,
  },
  trailing: {
    alignItems: 'flex-start',
  },
  content: {
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  chevronRail: {
    width: 16,
    alignItems: 'flex-end',
    paddingTop: 6,
  },
  chevron: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    color: C.muted,
  },
  chevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  editor: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
});
