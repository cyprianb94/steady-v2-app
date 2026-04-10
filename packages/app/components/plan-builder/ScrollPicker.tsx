import React, { useCallback, useRef, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

const ITEM_H = 38;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2); // 2 items above/below centre

interface ScrollPickerProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  activeColor?: string;
}

export function ScrollPicker({
  items,
  selectedIndex,
  onSelect,
  activeColor = C.clay,
}: ScrollPickerProps) {
  const scrollRef = useRef<ScrollView>(null);

  // Pad items so the first/last can reach centre
  const paddedItems = [
    ...Array(PAD).fill(''),
    ...items,
    ...Array(PAD).fill(''),
  ];

  useEffect(() => {
    if (scrollRef.current && selectedIndex >= 0) {
      scrollRef.current.scrollTo({
        y: selectedIndex * ITEM_H,
        animated: false,
      });
    }
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      if (clamped !== selectedIndex) {
        onSelect(clamped);
      }
    },
    [items.length, selectedIndex, onSelect],
  );

  return (
    <View style={[styles.container, { borderColor: C.border }]}>
      {/* Centre highlight band */}
      <View
        style={[
          styles.highlight,
          {
            top: PAD * ITEM_H,
            backgroundColor: `${activeColor}12`,
            borderTopColor: `${activeColor}40`,
            borderBottomColor: `${activeColor}40`,
          },
        ]}
        pointerEvents="none"
      />

      <ScrollView
        ref={scrollRef}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        nestedScrollEnabled
        style={styles.list}
      >
        {paddedItems.map((item, index) => {
          const realIndex = index - PAD;
          const dist = Math.abs(realIndex - selectedIndex);
          const isCentre = dist === 0;
          const isAdjacent = dist === 1;

          return (
            <View key={index} style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  isCentre && { fontSize: 17, fontWeight: '700', color: activeColor },
                  isAdjacent && { fontSize: 13, fontWeight: '400', color: C.ink2 },
                  dist > 1 && { fontSize: 11, color: C.muted, opacity: 0.3 },
                ]}
              >
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Top fade gradient */}
      <LinearGradient
        colors={[C.cream, `${C.cream}00`]}
        style={[styles.fade, styles.fadeTop]}
        pointerEvents="none"
      />
      {/* Bottom fade gradient */}
      <LinearGradient
        colors={[`${C.cream}00`, C.cream]}
        style={[styles.fade, styles.fadeBottom]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: ITEM_H * VISIBLE,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: C.cream,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
  },
  item: {
    height: ITEM_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: C.muted,
  },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_H,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    zIndex: 1,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_H * PAD,
    zIndex: 2,
  },
  fadeTop: {
    top: 0,
  },
  fadeBottom: {
    bottom: 0,
  },
});
