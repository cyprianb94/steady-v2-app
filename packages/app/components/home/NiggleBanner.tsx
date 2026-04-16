import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Niggle } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

const BODY_PART_LABELS: Record<Niggle['bodyPart'], string> = {
  calf: 'Calf',
  knee: 'Knee',
  hamstring: 'Hamstring',
  quad: 'Quad',
  hip: 'Hip',
  glute: 'Glute',
  foot: 'Foot',
  shin: 'Shin',
  ankle: 'Ankle',
  achilles: 'Achilles',
  back: 'Back',
  other: 'Other',
};

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function formatNiggle(niggle: Niggle): string {
  const side = niggle.side ? `${titleCase(niggle.side)} ` : '';
  return `${side}${BODY_PART_LABELS[niggle.bodyPart]} · ${titleCase(niggle.severity)} · ${titleCase(niggle.when)}`;
}

interface NiggleBannerProps {
  niggles: Niggle[];
}

export function NiggleBanner({ niggles }: NiggleBannerProps) {
  if (niggles.length === 0) {
    return null;
  }

  const lead = niggles[0]!;
  const extraCount = niggles.length - 1;
  const summary = extraCount > 0
    ? `${formatNiggle(lead)} + ${extraCount} more`
    : formatNiggle(lead);

  return (
    <View style={styles.banner}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>!</Text>
      </View>
      <Text style={styles.copy}>
        You flagged <Text style={styles.copyStrong}>{summary}</Text>. We&apos;ll keep an eye on it across your next few sessions.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(196,82,42,0.30)',
    backgroundColor: C.clayBg,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  icon: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.clay,
    marginTop: 1,
  },
  iconText: {
    fontFamily: FONTS.serifBold,
    fontSize: 11,
    color: C.surface,
    lineHeight: 11,
  },
  copy: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.ink2,
  },
  copyStrong: {
    fontFamily: FONTS.sansSemiBold,
    color: C.clay,
  },
});
