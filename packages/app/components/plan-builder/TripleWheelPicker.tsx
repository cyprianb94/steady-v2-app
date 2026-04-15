import React, { useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

const ITEM_H = 28;
const VISIBLE = 3;
const PAD = Math.floor(VISIBLE / 2);
const LABEL_H = 22;

interface WheelColumnConfig {
  items: string[];
  label: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
}

interface TripleWheelPickerProps {
  columns: WheelColumnConfig[];
  activeColor: string;
  borderColor: string;
  backgroundColor?: string;
  separators?: string[];
}

function WheelColumn({ items, label, selectedIndex, onSelect }: WheelColumnConfig) {
  const scrollRef = useRef<ScrollView>(null);
  const paddedItems = [...Array(PAD).fill(''), ...items, ...Array(PAD).fill('')];

  useEffect(() => {
    scrollRef.current?.scrollTo({
      y: selectedIndex * ITEM_H,
      animated: false,
    });
  }, [selectedIndex, items.length]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      if (clamped !== selectedIndex) {
        onSelect(clamped);
      }
    },
    [items.length, onSelect, selectedIndex],
  );

  return (
    <View style={styles.column}>
      <ScrollView
        ref={scrollRef}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={styles.scrollRegion}
      >
        {paddedItems.map((item, index) => {
          const realIndex = index - PAD;
          const dist = Math.abs(realIndex - selectedIndex);
          const isCentre = dist === 0;
          const isAdjacent = dist === 1;

          return (
            <View key={`${label}-${index}`} style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  isCentre && styles.itemTextActive,
                  isAdjacent && styles.itemTextAdjacent,
                  dist > 1 && styles.itemTextFar,
                ]}
              >
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.labelWrap}>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

export function TripleWheelPicker({
  columns,
  activeColor,
  borderColor,
  backgroundColor = C.surface,
  separators = [],
}: TripleWheelPickerProps) {
  return (
    <View style={[styles.container, { borderColor, backgroundColor }]}>
      <View
        pointerEvents="none"
        style={[
          styles.highlight,
          {
            backgroundColor: `${activeColor}12`,
            borderTopColor: `${activeColor}40`,
            borderBottomColor: `${activeColor}40`,
          },
        ]}
      />
      <View style={styles.columnsRow}>
        {columns.map((column, index) => (
          <React.Fragment key={column.label}>
            <WheelColumn {...column} />
            {index < columns.length - 1 && separators[index] ? (
              <View style={styles.separatorWrap}>
                <Text style={[styles.separator, { color: activeColor }]}>{separators[index]}</Text>
              </View>
            ) : null}
          </React.Fragment>
        ))}
      </View>
      <LinearGradient
        colors={[backgroundColor, `${backgroundColor}00`]}
        style={[styles.fade, styles.fadeTop]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[`${backgroundColor}00`, backgroundColor]}
        style={[styles.fade, styles.fadeBottom]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1.5,
    height: ITEM_H * VISIBLE + LABEL_H,
    overflow: 'hidden',
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_H,
    height: ITEM_H,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    zIndex: 1,
  },
  columnsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flex: 1,
  },
  column: {
    flex: 1,
  },
  scrollRegion: {
    height: ITEM_H * VISIBLE,
  },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.ink2,
    opacity: 0.5,
  },
  itemTextActive: {
    fontFamily: FONTS.monoBold,
    fontSize: 16,
    opacity: 1,
  },
  itemTextAdjacent: {
    fontSize: 11,
    opacity: 0.45,
  },
  itemTextFar: {
    opacity: 0.18,
  },
  labelWrap: {
    height: LABEL_H,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    color: C.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  separatorWrap: {
    width: 14,
    alignItems: 'flex-start',
    paddingTop: 34,
    zIndex: 2,
  },
  separator: {
    fontFamily: FONTS.monoBold,
    fontSize: 16,
    lineHeight: 16,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_H,
    zIndex: 2,
  },
  fadeTop: {
    top: 0,
  },
  fadeBottom: {
    bottom: LABEL_H,
  },
});
