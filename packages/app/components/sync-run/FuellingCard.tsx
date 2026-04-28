import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
} from 'react-native';
import type { RunFuelEvent, RunFuelGel } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { triggerSegmentTickHaptic, triggerSelectionChangeHaptic } from '../../lib/haptics';
import { GEL_BRANDS, gelsForBrand, searchBrands } from '../../features/fuelling/gel-catalogue';
import {
  createFuelEvent,
  formatFuelSummary,
  formatGelStats,
  maxFuelMinute,
  nextFuelMinute,
  sortFuelEvents,
} from '../../features/fuelling/fuel-events';

interface FuellingCardProps {
  durationSeconds: number;
  fuelEvents: RunFuelEvent[];
  recentGels: RunFuelGel[];
  suggestedBrands: string[];
  onSliderDragChange?: (active: boolean) => void;
  onChange: (events: RunFuelEvent[]) => void;
}

interface FuelMinuteSliderProps {
  maxMinute: number;
  minute: number;
  events: RunFuelEvent[];
  onDragChange?: (active: boolean) => void;
  onChange: (minute: number) => void;
}

function clampMinute(value: number, maxMinute: number): number {
  return Math.max(0, Math.min(maxMinute, Math.round(value)));
}

function uniqueBrands(brands: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const brand of brands) {
    if (!brand || seen.has(brand)) continue;
    seen.add(brand);
    unique.push(brand);
  }

  return unique;
}

function FuelMinuteSlider({ maxMinute, minute, events, onDragChange, onChange }: FuelMinuteSliderProps) {
  const trackRef = useRef<View>(null);
  const trackFrameRef = useRef({ x: 0, width: 0, measured: false });
  const lastHapticMinuteRef = useRef(minute);
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = maxMinute > 0 ? minute / maxMinute : 0;
  const ticks = useMemo(() => {
    const values: number[] = [];
    for (let tick = 0; tick <= maxMinute; tick += 5) values.push(tick);
    if (values.at(-1) !== maxMinute) values.push(maxMinute);
    return values;
  }, [maxMinute]);

  useEffect(() => {
    lastHapticMinuteRef.current = minute;
  }, [minute]);

  useEffect(() => () => onDragChange?.(false), [onDragChange]);

  const emitMinuteChange = (nextMinute: number, haptic: 'none' | 'selection' | 'tick' = 'none') => {
    const clamped = clampMinute(nextMinute, maxMinute);
    if (clamped === minute) return false;

    onChange(clamped);
    if (haptic === 'selection') {
      triggerSelectionChangeHaptic();
    } else if (haptic === 'tick' && clamped % 5 === 0 && clamped !== lastHapticMinuteRef.current) {
      lastHapticMinuteRef.current = clamped;
      triggerSegmentTickHaptic();
    }
    return true;
  };

  const updateFromX = (x: number, width = trackWidth) => {
    if (!width || maxMinute <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / width));
    emitMinuteChange(ratio * maxMinute, 'tick');
  };

  const measureTrack = () => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      trackFrameRef.current = { x, width, measured: true };
      if (width) setTrackWidth(width);
    });
  };

  const updateFromEvent = (event: GestureResponderEvent) => {
    const frame = trackFrameRef.current;
    const pageX = event.nativeEvent.pageX;
    if (frame.measured && Number.isFinite(pageX)) {
      updateFromX(pageX - frame.x, frame.width);
      return;
    }

    updateFromX(event.nativeEvent.locationX);
  };

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>Minute</Text>
        <Text style={styles.sliderRange}>0-{maxMinute} min</Text>
      </View>
      <View style={styles.minuteReadoutRow}>
        <Pressable
          onPress={() => {
            emitMinuteChange(minute - 1, 'selection');
          }}
          style={styles.minuteStep}
        >
          <Text style={styles.minuteStepText}>-</Text>
        </Pressable>
        <Text style={styles.minuteReadout}>{minute} min</Text>
        <Pressable
          onPress={() => {
            emitMinuteChange(minute + 1, 'selection');
          }}
          style={styles.minuteStep}
        >
          <Text style={styles.minuteStepText}>+</Text>
        </Pressable>
      </View>

      <View
        ref={trackRef}
        style={styles.trackWrap}
        onLayout={(event: LayoutChangeEvent) => {
          setTrackWidth(event.nativeEvent.layout.width);
          requestAnimationFrame(measureTrack);
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          onDragChange?.(true);
          measureTrack();
          updateFromEvent(event);
        }}
        onResponderMove={updateFromEvent}
        onResponderRelease={() => onDragChange?.(false)}
        onResponderTerminate={() => onDragChange?.(false)}
      >
        <View pointerEvents="none" style={styles.trackBase} />
        <View pointerEvents="none" style={[styles.trackFill, { width: `${progress * 100}%` as DimensionValue }]} />
        {ticks.map((tick) => {
          const left = maxMinute > 0 ? `${(tick / maxMinute) * 100}%` : '0%';
          const major = tick % 15 === 0 || tick === maxMinute;
          return (
            <View
              key={tick}
              pointerEvents="none"
              style={[
                styles.tick,
                major && styles.tickMajor,
                { left: left as DimensionValue },
              ]}
            >
              {major ? <Text style={styles.tickLabel}>{tick}</Text> : null}
            </View>
          );
        })}
        {events.map((event) => (
          <View
            key={event.id}
            pointerEvents="none"
            style={[
              styles.fuelMarker,
              { left: `${maxMinute > 0 ? (event.minute / maxMinute) * 100 : 0}%` as DimensionValue },
            ]}
          />
        ))}
        <View pointerEvents="none" style={[styles.thumb, { left: `${progress * 100}%` as DimensionValue }]}>
          <Text style={styles.thumbText}>{minute}</Text>
        </View>
      </View>

      <View style={styles.quickMinutes}>
        {[15, 30, 45, 60].filter((value) => value <= maxMinute).map((value) => (
          <Pressable
            key={value}
            onPress={() => {
              emitMinuteChange(value, 'selection');
            }}
            style={[styles.quickMinute, minute === value && styles.quickMinuteSelected]}
          >
            <Text style={[styles.quickMinuteText, minute === value && styles.quickMinuteTextSelected]}>
              {value}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function FuellingCard({
  durationSeconds,
  fuelEvents,
  recentGels,
  suggestedBrands,
  onSliderDragChange,
  onChange,
}: FuellingCardProps) {
  const runMaxMinute = maxFuelMinute(durationSeconds);
  const sortedEvents = useMemo(() => sortFuelEvents(fuelEvents), [fuelEvents]);
  const eventBrands = useMemo(() => uniqueBrands(sortedEvents.map((event) => event.gel.brand)), [sortedEvents]);
  const [expanded, setExpanded] = useState(false);
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [minute, setMinute] = useState(Math.min(30, runMaxMinute));
  const [brandQuery, setBrandQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState(suggestedBrands[0] ?? GEL_BRANDS[0] ?? '');
  const [pinnedBrands, setPinnedBrands] = useState<string[]>(() =>
    uniqueBrands([suggestedBrands[0] ?? GEL_BRANDS[0] ?? '', ...eventBrands]),
  );
  const brandOptions = brandQuery.trim() ? searchBrands(brandQuery) : GEL_BRANDS;
  const visibleBrandChips = uniqueBrands([selectedBrand, ...pinnedBrands]);
  const brandGels = useMemo(() => gelsForBrand(selectedBrand), [selectedBrand]);
  const [selectedGelId, setSelectedGelId] = useState<string | null>(brandGels[0]?.id ?? null);
  const selectedGel = brandGels.find((gel) => gel.id === selectedGelId) ?? brandGels[0] ?? null;

  useEffect(() => {
    setMinute((current) => clampMinute(current, runMaxMinute));
  }, [runMaxMinute]);

  useEffect(() => {
    if (!selectedBrand && suggestedBrands[0]) {
      setSelectedBrand(suggestedBrands[0]);
    }
  }, [selectedBrand, suggestedBrands]);

  useEffect(() => {
    setPinnedBrands((current) => uniqueBrands([...current, ...eventBrands]));
  }, [eventBrands]);

  useEffect(() => {
    if (!brandGels.some((gel) => gel.id === selectedGelId)) {
      setSelectedGelId(brandGels[0]?.id ?? null);
    }
  }, [brandGels, selectedGelId]);

  function pinBrand(brand: string) {
    setPinnedBrands((current) => uniqueBrands([brand, ...current]));
  }

  function selectBrand(brand: string, collapseCatalogue = true) {
    setSelectedBrand(brand);
    pinBrand(brand);
    setBrandQuery('');
    if (collapseCatalogue) setShowBrandPicker(false);
  }

  function addSelectedGel() {
    if (!selectedGel) return;
    const event = createFuelEvent(selectedGel, minute);
    const nextEvents = sortFuelEvents([...fuelEvents, event]);
    pinBrand(selectedGel.brand);
    onChange(nextEvents);
    setMinute(nextFuelMinute(minute, runMaxMinute));
  }

  function removeFuelEvent(eventId: string) {
    onChange(fuelEvents.filter((event) => event.id !== eventId));
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionTitle}>Fuelling</Text>
          <Text style={styles.sectionSub}>Gels taken during this run</Text>
        </View>
        <Text style={[styles.summaryText, !sortedEvents.length && styles.summaryTextEmpty]}>{formatFuelSummary(sortedEvents)}</Text>
      </View>

      {sortedEvents.length ? (
        <View style={styles.eventList}>
          {sortedEvents.map((event) => (
            <View key={event.id} style={styles.eventRow}>
              <Text style={styles.eventMinute}>{event.minute} min</Text>
              <View style={styles.eventGelBody}>
                <Text style={styles.eventGelName}>{event.gel.name}</Text>
                <Text style={styles.eventGelMeta}>
                  {event.gel.brand} · {formatGelStats(event.gel)}
                </Text>
              </View>
              <Pressable onPress={() => removeFuelEvent(event.id)} style={styles.removeButton}>
                <Text style={styles.removeButtonText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyCopy}>No gels logged for this run.</Text>
      )}

      <Pressable onPress={() => setExpanded((current) => !current)} style={styles.addToggle}>
        <Text style={styles.addToggleText}>{expanded ? 'Close fuelling editor' : '+ Add gel'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.editor}>
          <FuelMinuteSlider
            maxMinute={runMaxMinute}
            minute={minute}
            events={sortedEvents}
            onDragChange={onSliderDragChange}
            onChange={setMinute}
          />

          {recentGels.length ? (
            <View style={styles.editorBlock}>
              <Text style={styles.blockLabel}>Used before</Text>
              <View style={styles.usedGrid}>
                {recentGels.map((gel) => {
                  const selected = selectedGel?.id === gel.id;
                  return (
                    <Pressable
                      key={gel.id}
                      onPress={() => {
                        selectBrand(gel.brand);
                        setSelectedGelId(gel.id);
                      }}
                      style={[styles.usedCard, selected && styles.usedCardSelected]}
                    >
                      <Text style={[styles.usedName, selected && styles.usedNameSelected]}>{gel.name}</Text>
                      <Text style={[styles.usedMeta, selected && styles.usedMetaSelected]}>{formatGelStats(gel)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.editorBlock}>
            <Text style={styles.blockLabel}>Brand</Text>
            <View style={styles.selectedBrandRow}>
              {visibleBrandChips.map((brand) => {
                const selected = selectedBrand === brand;
                return (
                  <Pressable
                    key={brand}
                    onPress={() => selectBrand(brand, false)}
                    style={[styles.selectedBrandChip, selected && styles.selectedBrandChipActive]}
                  >
                    <Text style={[styles.selectedBrandChipText, selected && styles.selectedBrandChipTextActive]}>
                      {brand}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setShowBrandPicker(true)}
                style={styles.addBrandButton}
              >
                <Text style={styles.addBrandButtonText}>Browse brands</Text>
              </Pressable>
            </View>

            {showBrandPicker ? (
              <View style={styles.brandPickerPanel}>
                <View style={styles.brandPickerHeader}>
                  <Text style={styles.brandPickerTitle}>Brand catalogue</Text>
                  <Pressable
                    onPress={() => setShowBrandPicker(false)}
                    accessibilityLabel="Collapse brand catalogue"
                    style={styles.brandCollapseButton}
                  >
                    <Text style={styles.brandCollapseButtonText}>⌃</Text>
                  </Pressable>
                </View>
                <TextInput
                  value={brandQuery}
                  onChangeText={setBrandQuery}
                  placeholder="Search brand"
                  placeholderTextColor={C.muted}
                  style={styles.brandSearch}
                />
                <Text style={styles.brandPickerHint}>
                  {brandQuery.trim() ? 'Matching brands' : 'Brands'}
                </Text>
                <ScrollView
                  style={styles.brandOptionScroll}
                  contentContainerStyle={styles.brandOptionList}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {brandOptions.map((brand) => {
                    const selected = selectedBrand === brand;
                    return (
                      <Pressable
                        key={brand}
                        onPress={() => selectBrand(brand)}
                        style={[styles.brandOption, selected && styles.brandOptionSelected]}
                      >
                        <Text style={[styles.brandOptionText, selected && styles.brandOptionTextSelected]}>{brand}</Text>
                        {selected ? <Text style={styles.brandOptionSelectedMark}>Selected</Text> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <View style={styles.editorBlock}>
            <View style={styles.gelHead}>
              <Text style={styles.blockLabel}>Gel</Text>
              <Text style={styles.gelCount}>{brandGels.length} options</Text>
            </View>
            <View style={styles.gelList}>
              {brandGels.map((gel) => {
                const selected = selectedGel?.id === gel.id;
                return (
                  <Pressable
                    key={gel.id}
                    onPress={() => setSelectedGelId(gel.id)}
                    style={[styles.gelCard, selected && styles.gelCardSelected]}
                  >
                    <View style={styles.gelPacket}>
                      <Text style={styles.gelPacketText}>{gel.carbsG ?? '-'}</Text>
                    </View>
                    <View style={styles.gelCardBody}>
                      <Text style={[styles.gelName, selected && styles.gelNameSelected]}>{gel.name}</Text>
                      <Text style={styles.gelFlavour}>{gel.flavour}</Text>
                      <Text style={styles.gelStats}>{formatGelStats(gel)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.addBar}>
            <View style={styles.selectedSummary}>
              <Text style={styles.selectedLabel}>Selected</Text>
              <Text style={styles.selectedValue}>{selectedGel ? `${selectedGel.name} · ${formatGelStats(selectedGel)}` : 'Choose a gel'}</Text>
            </View>
            <Pressable
              onPress={addSelectedGel}
              disabled={!selectedGel}
              style={[styles.addButton, !selectedGel && styles.addButtonDisabled]}
            >
              <Text style={styles.addButtonText}>Add at {minute} min</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 17,
    color: C.ink,
  },
  sectionSub: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  summaryText: {
    flex: 1,
    textAlign: 'right',
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: C.metricFuelling,
    lineHeight: 17,
  },
  summaryTextEmpty: {
    color: C.muted,
  },
  emptyCopy: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
    marginBottom: 12,
  },
  eventList: {
    gap: 8,
    marginBottom: 12,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  eventMinute: {
    width: 54,
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: C.metricFuelling,
  },
  eventGelBody: {
    flex: 1,
  },
  eventGelName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
    marginBottom: 2,
  },
  eventGelMeta: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.muted,
  },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  removeButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.muted,
  },
  addToggle: {
    borderWidth: 1,
    borderColor: C.metricFuelling,
    backgroundColor: C.surface,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addToggleText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.metricFuelling,
  },
  editor: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 14,
  },
  sliderBlock: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cream,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sliderRange: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.muted,
  },
  minuteReadoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  minuteStep: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minuteStepText: {
    fontFamily: FONTS.monoBold,
    fontSize: 17,
    color: C.ink,
  },
  minuteReadout: {
    fontFamily: FONTS.monoBold,
    fontSize: 30,
    color: C.ink,
  },
  trackWrap: {
    height: 78,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBase: {
    height: 6,
    borderRadius: 999,
    backgroundColor: C.border,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 36,
    height: 6,
    borderRadius: 999,
    backgroundColor: C.metricFuelling,
  },
  tick: {
    position: 'absolute',
    top: 28,
    width: 1,
    height: 18,
    backgroundColor: C.muted,
    opacity: 0.35,
  },
  tickMajor: {
    top: 22,
    height: 26,
    opacity: 0.55,
  },
  tickLabel: {
    position: 'absolute',
    top: 32,
    left: -10,
    width: 22,
    textAlign: 'center',
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: C.muted,
  },
  fuelMarker: {
    position: 'absolute',
    top: 10,
    width: 7,
    height: 7,
    marginLeft: -3.5,
    borderRadius: 999,
    backgroundColor: C.metricFuelling,
  },
  thumb: {
    position: 'absolute',
    top: 20,
    width: 30,
    height: 30,
    marginLeft: -15,
    borderRadius: 999,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbText: {
    fontFamily: FONTS.monoBold,
    fontSize: 9,
    color: C.surface,
  },
  quickMinutes: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  quickMinute: {
    minWidth: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  quickMinuteSelected: {
    borderColor: C.metricFuelling,
    backgroundColor: C.surface,
  },
  quickMinuteText: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: C.muted,
  },
  quickMinuteTextSelected: {
    color: C.metricFuelling,
  },
  editorBlock: {
    gap: 10,
  },
  blockLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  selectedBrandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  selectedBrandChip: {
    flexShrink: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedBrandChipActive: {
    borderWidth: 1.5,
    borderColor: C.metricFuelling,
    backgroundColor: C.surface,
  },
  selectedBrandChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  selectedBrandChipTextActive: {
    color: C.metricFuelling,
  },
  addBrandButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBrandButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  brandPickerPanel: {
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cream,
    padding: 12,
  },
  brandPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandPickerTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  brandCollapseButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCollapseButtonText: {
    fontFamily: FONTS.monoBold,
    fontSize: 16,
    lineHeight: 18,
    color: C.ink2,
  },
  usedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  usedCard: {
    flexGrow: 1,
    minWidth: '30%',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  usedCardSelected: {
    borderColor: C.metricFuelling,
    backgroundColor: C.surface,
  },
  usedName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink,
    marginBottom: 3,
  },
  usedNameSelected: {
    color: C.metricFuelling,
  },
  usedMeta: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.muted,
  },
  usedMetaSelected: {
    color: C.metricFuelling,
  },
  brandSearch: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    backgroundColor: C.cream,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.ink,
  },
  brandPickerHint: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  brandOptionList: {
    gap: 7,
    paddingBottom: 2,
  },
  brandOptionScroll: {
    maxHeight: 318,
  },
  brandOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  brandOptionSelected: {
    borderColor: C.metricFuelling,
    backgroundColor: C.surface,
  },
  brandOptionText: {
    flex: 1,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  brandOptionTextSelected: {
    color: C.metricFuelling,
  },
  brandOptionSelectedMark: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    color: C.metricFuelling,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  gelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gelCount: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.muted,
  },
  gelList: {
    gap: 8,
  },
  gelCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  gelCardSelected: {
    borderWidth: 1.5,
    borderColor: C.metricFuelling,
    backgroundColor: C.surface,
  },
  gelPacket: {
    width: 38,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gelPacketText: {
    fontFamily: FONTS.monoBold,
    fontSize: 14,
    color: C.metricFuelling,
  },
  gelCardBody: {
    flex: 1,
  },
  gelName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
    marginBottom: 2,
  },
  gelNameSelected: {
    color: C.metricFuelling,
  },
  gelFlavour: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.ink2,
    marginBottom: 3,
  },
  gelStats: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.muted,
  },
  addBar: {
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  selectedSummary: {
    gap: 2,
  },
  selectedLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  selectedValue: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.ink,
  },
  addButton: {
    borderRadius: 999,
    backgroundColor: C.ink,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.surface,
  },
});
