import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { shoeLifetimeKm, type Shoe } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { shoeWearState } from '../../features/sync/sync-run-detail';
import { SyncRunModalShell } from './SyncRunModalShell';

interface ShoePickerModalProps {
  visible: boolean;
  shoes: Shoe[];
  selectedShoeId: string | null;
  onSelect: (shoeId: string | null) => void;
  onClose: () => void;
  onDone: () => void;
}

export function ShoePickerModal({
  visible,
  shoes,
  selectedShoeId,
  onSelect,
  onClose,
  onDone,
}: ShoePickerModalProps) {
  const activeShoes = shoes.filter((shoe) => !shoe.retired);
  const retiredShoes = shoes.filter((shoe) => shoe.retired);

  return (
    <SyncRunModalShell
      visible={visible}
      title="Which shoe?"
      onClose={onClose}
      rightActionLabel="Done"
      onRightAction={onDone}
    >
      <Text style={styles.screenTitle}>Change shoe</Text>
      <Text style={styles.screenSub}>
        Auto-detected from Strava. Override for this run only if it&apos;s wrong.
      </Text>

      {activeShoes.length ? <Text style={styles.groupLabel}>Active shoes</Text> : null}
      {activeShoes.map((shoe) => {
        const selected = selectedShoeId === shoe.id;
        const wear = shoeWearState(shoe);
        const lifetimeKm = shoeLifetimeKm(shoe);
        const wearPct = shoe.retireAtKm ? Math.min(100, Math.round((lifetimeKm / shoe.retireAtKm) * 100)) : 0;

        return (
          <Pressable
            key={shoe.id}
            onPress={() => onSelect(shoe.id)}
            style={[styles.shoeRow, selected && styles.shoeRowSelected]}
          >
            <View style={styles.shoeBody}>
              <View style={styles.shoeNameRow}>
                <Text style={styles.shoeName}>{shoe.nickname ?? `${shoe.brand} ${shoe.model}`}</Text>
                {shoe.stravaGearId ? <Text style={[styles.shoeTag, styles.shoeTagStrava]}>FROM STRAVA</Text> : null}
              </View>
              <Text style={styles.shoeMeta}>
                lifetime <Text style={styles.shoeMetaStrong}>{Math.round(lifetimeKm)} km</Text>
                {shoe.retireAtKm ? ` · retire at ${Math.round(shoe.retireAtKm)}` : ''}
              </Text>
              {shoe.retireAtKm ? (
                <View style={styles.shoeBar}>
                  <View
                    style={[
                      styles.shoeBarFill,
                      wear === 'warn' && styles.shoeBarFillWarn,
                      wear === 'critical' && styles.shoeBarFillCritical,
                      { width: `${wearPct}%` },
                    ]}
                  />
                </View>
              ) : null}
            </View>
            <View style={[styles.radio, selected && styles.radioSelected]}>
              <View style={[styles.radioDot, selected && styles.radioDotSelected]} />
            </View>
          </Pressable>
        );
      })}

      {retiredShoes.length ? <Text style={styles.groupLabel}>Retired</Text> : null}
      {retiredShoes.map((shoe) => {
        const selected = selectedShoeId === shoe.id;
        const lifetimeKm = shoeLifetimeKm(shoe);
        const wearPct = shoe.retireAtKm ? Math.min(100, Math.round((lifetimeKm / shoe.retireAtKm) * 100)) : 100;

        return (
          <Pressable
            key={shoe.id}
            onPress={() => onSelect(shoe.id)}
            style={[styles.shoeRow, styles.shoeRowRetired, selected && styles.shoeRowSelected]}
          >
            <View style={styles.shoeBody}>
              <View style={styles.shoeNameRow}>
                <Text style={styles.shoeName}>{shoe.nickname ?? `${shoe.brand} ${shoe.model}`}</Text>
                <Text style={styles.shoeTag}>RETIRED</Text>
              </View>
              <Text style={styles.shoeMeta}>
                lifetime <Text style={styles.shoeMetaStrong}>{Math.round(lifetimeKm)} km</Text>
              </Text>
              <View style={styles.shoeBar}>
                <View style={[styles.shoeBarFill, styles.shoeBarFillCritical, { width: `${wearPct}%` }]} />
              </View>
            </View>
            <View style={[styles.radio, selected && styles.radioSelected]}>
              <View style={[styles.radioDot, selected && styles.radioDotSelected]} />
            </View>
          </Pressable>
        );
      })}

      <Pressable onPress={() => onSelect(null)} style={styles.clearButton}>
        <Text style={styles.clearButtonText}>+ Not tracked / add new shoe</Text>
      </Pressable>
    </SyncRunModalShell>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 28,
    color: C.ink,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  screenSub: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    color: C.muted,
    paddingHorizontal: 4,
    marginBottom: 22,
  },
  groupLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 10,
  },
  shoeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    marginBottom: 10,
  },
  shoeRowSelected: {
    borderWidth: 1.5,
    borderColor: C.forest,
    backgroundColor: C.forestBg,
  },
  shoeRowRetired: {
    opacity: 0.6,
  },
  shoeBody: {
    flex: 1,
  },
  shoeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 3,
  },
  shoeName: {
    fontFamily: FONTS.serifBold,
    fontSize: 15,
    color: C.ink,
  },
  shoeTag: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: C.card,
    overflow: 'hidden',
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: C.muted,
  },
  shoeTagStrava: {
    backgroundColor: C.clayBg,
    color: C.clay,
  },
  shoeMeta: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.muted,
  },
  shoeMetaStrong: {
    fontFamily: FONTS.monoBold,
    color: C.ink,
  },
  shoeBar: {
    marginTop: 6,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: C.card,
  },
  shoeBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: C.forest,
  },
  shoeBarFillWarn: {
    backgroundColor: C.amber,
  },
  shoeBarFillCritical: {
    backgroundColor: C.clay,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  radioSelected: {
    borderColor: C.forest,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
  },
  radioDotSelected: {
    backgroundColor: C.forest,
  },
  clearButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.border,
    alignItems: 'center',
  },
  clearButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.muted,
  },
});
