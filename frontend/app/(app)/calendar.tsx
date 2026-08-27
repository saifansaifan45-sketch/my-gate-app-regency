import { PremiumPressable } from '../../src/components/ui/PremiumPressable';
import { Feather } from '@expo/vector-icons';
import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { theme } from '../../src/theme';
import { useCalendarEvents } from '../../src/store/calendar-events';
import { AppHeader } from '../../src/components/ui/AppHeader';
import { useScreenInsets } from '../../src/hooks/useScreenInsets';
import { cardSystem } from '../../src/components/ui/cardSystem';

const MAX_YEAR = 2026;
const MAX_MONTH = 11;

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');

const toDateStr = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

const toLocalDateStr = (date: Date) => toDateStr(date.getFullYear(), date.getMonth(), date.getDate());

export default function CalendarScreen() {
  const { bottomClearance } = useScreenInsets(false);
  const events = useCalendarEvents();

  const todayStr = toLocalDateStr(new Date());

  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const isAtMax = viewYear === MAX_YEAR && viewMonth === MAX_MONTH;

  const goPrevMonth = () => {
    setSelectedDate(todayStr);
    setViewYear((y) => (viewMonth === 0 ? y - 1 : y));
    setViewMonth((m) => (m === 0 ? 11 : m - 1));
  };

  const goNextMonth = () => {
    if (isAtMax) return;
    setSelectedDate(todayStr);
    setViewYear((y) => (viewMonth === 11 ? y + 1 : y));
    setViewMonth((m) => (m === 11 ? 0 : m + 1));
  };

  const eventsByDate = useMemo(() => {
    const map: Record<string, typeof events> = {};
    events.forEach((e) => {
      (map[e.date] = map[e.date] || []).push(e);
    });
    return map;
  }, [events]);

  const weeks = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const result: Array<Array<{ day: number; dateStr: string } | null>> = [];
    let currentWeek: Array<{ day: number; dateStr: string } | null> = [];

    for (let i = 0; i < firstWeekday; i++) {
      currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = toDateStr(viewYear, viewMonth, day);
      currentWeek.push({ day, dateStr });
      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      result.push(currentWeek);
    }

    return result;
  }, [viewYear, viewMonth]);

  const monthLabel = useMemo(() => {
    const date = new Date(viewYear, viewMonth, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [viewYear, viewMonth]);

  const selectedEvents = eventsByDate[selectedDate] || [];

  const selectedDisplay = (() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  })();

  return (
    <View style={styles.container}>
      <AppHeader variant="subscreen" title="Community Calendar" />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]}>

        <ScreenEntrance delay={100}>
          <Card style={styles.calendarCard}>
            <View style={styles.monthHeader}>
              <PremiumPressable style={styles.monthNavBtn} onPress={goPrevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="chevron-left" size={22} color={theme.colors.textPrimary} />
              </PremiumPressable>
              <Text style={styles.monthTitle}>{monthLabel}</Text>
              <PremiumPressable
                style={[styles.monthNavBtn, isAtMax && styles.monthNavBtnDisabled]}
                onPress={goNextMonth}
                disabled={isAtMax}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="chevron-right" size={22} color={isAtMax ? theme.colors.border : theme.colors.textPrimary} />
              </PremiumPressable>
            </View>

            <View style={styles.weekDays}>
              {WEEKDAYS.map((d, i) => (
                <Text key={`weekday-${i}-${d}`} style={styles.weekDayText}>{d}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {weeks.map((week, weekIdx) => (
                <View key={`week-${viewYear}-${viewMonth}-${weekIdx}`} style={styles.weekRow}>
                  {week.map((cell, colIdx) => {
                    if (!cell || !cell.day || !cell.dateStr) {
                      return <View key={`empty-${viewYear}-${viewMonth}-${weekIdx}-${colIdx}`} style={styles.dayCellEmpty} />;
                    }
                    const currentCell = cell;
                    const isSelected = selectedDate === currentCell.dateStr;
                    const isToday = currentCell.dateStr === todayStr;
                    const hasEvent = !!eventsByDate[currentCell.dateStr];
                    return (
                      <PremiumPressable
                        key={currentCell.dateStr}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                          isToday && !isSelected && styles.dayCellToday,
                        ]}
                        onPress={() => setSelectedDate(currentCell.dateStr)}
                      >
                        <Text style={[styles.dayText, isSelected && styles.dayTextSelected, isToday && !isSelected && styles.dayTextToday]}>
                          {currentCell.day}
                        </Text>
                        {hasEvent && <View style={[styles.eventDot, isSelected && styles.eventDotSelected]} />}
                      </PremiumPressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </Card>
        </ScreenEntrance>

        <ScreenEntrance delay={200}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{selectedDisplay}</Text>
            {selectedDate === todayStr && <Text style={styles.todayTag}>Today</Text>}
          </View>

          {selectedEvents.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Feather name="calendar" size={28} color={theme.colors.textSecondary} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No events on this day.</Text>
            </Card>
          ) : (
            selectedEvents.map((ev) => (
              <Card key={ev.id} style={styles.eventItemCard}>
                <View style={styles.eventDotLarge} />
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  <Text style={styles.eventMeta}>{ev.time} • {ev.location}</Text>
                </View>
              </Card>
            ))
          )}
        </ScreenEntrance>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: cardSystem.pagePadding, paddingTop: 16 },
  calendarCard: { padding: 22, borderRadius: 18, marginBottom: 24 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  monthNavBtn: { width: 36, height: 36, borderRadius: 100, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  monthNavBtnDisabled: { opacity: 0.4 },
  monthTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, letterSpacing: -0.3, color: theme.colors.textPrimary },
  weekDays: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  weekDayText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: theme.colors.textSecondary, width: 40, textAlign: 'center' },
  daysGrid: { width: '100%' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dayCell: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 18, position: 'relative' },
  dayCellEmpty: { width: 40, height: 40 },
  dayCellSelected: { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
  dayCellToday: { borderWidth: 1.5, borderColor: theme.colors.primary },
  dayText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: theme.colors.textPrimary, textAlign: 'center' },
  dayTextSelected: { color: '#FFF', fontFamily: 'PlusJakartaSans_700Bold' },
  dayTextToday: { color: theme.colors.primary, fontFamily: 'PlusJakartaSans_700Bold' },
  eventDot: { width: 5, height: 5, borderRadius: 0.5, backgroundColor: theme.colors.accent, position: 'absolute', bottom: 3 },
  eventDotSelected: { backgroundColor: '#FFFFFF' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 4, marginBottom: 14 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, letterSpacing: -0.3, color: theme.colors.textPrimary },
  todayTag: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: theme.colors.accent, backgroundColor: '#FBF4F0', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 98, overflow: 'hidden' },
  emptyCard: { padding: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  emptyIcon: { marginBottom: 12, opacity: 0.8 },
  emptyText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, color: theme.colors.textSecondary },
  eventItemCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16, marginBottom: 14 },
  eventDotLarge: { width: 14, height: 14, borderRadius: 5, backgroundColor: theme.colors.accent, marginRight: 16 },
  eventInfo: { flex: 1 },
  eventTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: theme.colors.textPrimary, marginBottom: 4 },
  eventMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: theme.colors.textSecondary },
});
