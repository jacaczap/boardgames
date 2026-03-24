import React, { useCallback, useMemo, useState } from "react";
import { Alert, Modal, Pressable as RNPressable, StyleSheet } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { isPolishHoliday } from "@/lib/holidays";
import { getDateLocale } from "@/lib/i18n";
import type { DateOption, Profile } from "@/lib/types";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import UserAvatar from "@/components/UserAvatar";

const COLORS = {
  weekend: "#60a5fa",
  holiday: "#f87171",
  custom: "#a78bfa",
  selected: "#fbbf24",
  selectedBorder: "#b45309",
  past: "#d6d3d1",
  today: "#fef3c7",
  defaultText: "#44403c",
  disabledText: "#d6d3d1",
} as const;

function formatDateDisplay(dateStr: string, locale: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface CalendarDatePickerProps {
  dateOptions: DateOption[];
  selectedDates: Set<string>;
  onToggleDate: (dateOptionId: string) => void;
  onAddCustomDate: (dateStr: string) => Promise<void>;
  disabled: boolean;
  dateVoters: Map<string, Profile[]>;
  avatarUrls: Map<string, string>;
}

interface VoterModalProps {
  visible: boolean;
  onClose: () => void;
  dateStr: string;
  voters: Profile[];
  avatarUrls: Map<string, string>;
  locale: string;
}

const VoterModal: React.FC<VoterModalProps> = React.memo(
  ({ visible, onClose, dateStr, voters, avatarUrls, locale }) => {
    const { t } = useTranslation();
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <RNPressable style={styles.modalOverlay} onPress={onClose}>
          <RNPressable style={styles.modalContent} onPress={() => {}}>
            <VStack space="md">
              <HStack className="items-center justify-between">
                <Text className="font-semibold text-stone-800" size="lg">
                  {t("survey.votersForDate", {
                    date: formatDateDisplay(dateStr, locale),
                  })}
                </Text>
                <RNPressable onPress={onClose} hitSlop={8}>
                  <Ionicons name="close" size={22} color="#78716c" />
                </RNPressable>
              </HStack>
              {voters.length === 0 ? (
                <Text className="text-stone-400" size="sm">
                  {t("survey.noVotersYet")}
                </Text>
              ) : (
                <VStack space="sm">
                  {voters.map((p) => (
                    <HStack key={p.id} space="sm" className="items-center">
                      <UserAvatar profile={p} avatarUrls={avatarUrls} />
                      <Text className="text-stone-700">
                        {[p.name, p.surname].filter(Boolean).join(" ") ||
                          p.username ||
                          "?"}
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              )}
            </VStack>
          </RNPressable>
        </RNPressable>
      </Modal>
    );
  }
);

const Legend: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const items: { color: string; label: string; border?: boolean }[] = [
    { color: COLORS.weekend, label: t("survey.legendWeekend") },
    { color: COLORS.holiday, label: t("survey.legendHoliday") },
    { color: COLORS.custom, label: t("survey.legendCustom") },
    {
      color: COLORS.selected,
      label: t("survey.legendSelected"),
      border: true,
    },
  ];
  return (
    <HStack space="md" className="flex-wrap px-1 mb-1">
      {items.map((item) => (
        <HStack key={item.label} space="xs" className="items-center">
          <Box
            style={[
              styles.legendDot,
              { backgroundColor: item.color },
              item.border && styles.legendDotBorder,
            ]}
          />
          <Text size="xs" className="text-stone-500">
            {item.label}
          </Text>
        </HStack>
      ))}
    </HStack>
  );
});

const CalendarDatePicker: React.FC<CalendarDatePickerProps> = ({
  dateOptions,
  selectedDates,
  onToggleDate,
  onAddCustomDate,
  disabled,
  dateVoters,
  avatarUrls,
}) => {
  const { t } = useTranslation();
  const locale = getDateLocale();
  const today = todayStr();

  const [voterModal, setVoterModal] = useState<{
    visible: boolean;
    dateStr: string;
    voters: Profile[];
  }>({ visible: false, dateStr: "", voters: [] });

  const dateOptionMap = useMemo(() => {
    const m = new Map<string, DateOption>();
    for (const opt of dateOptions) m.set(opt.date, opt);
    return m;
  }, [dateOptions]);

  const dateRange = useMemo(() => {
    if (!dateOptions.length) return null;
    const sorted = [...dateOptions].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    return { min: sorted[0].date, max: sorted[sorted.length - 1].date };
  }, [dateOptions]);

  const initialMonth = useMemo(() => {
    if (!dateRange) return today;
    return dateRange.min > today ? dateRange.min : today;
  }, [dateRange, today]);

  const markedDates = useMemo(() => {
    const marks: Record<
      string,
      {
        customStyles: {
          container: Record<string, unknown>;
          text: Record<string, unknown>;
        };
      }
    > = {};

    for (const opt of dateOptions) {
      const isPast = opt.date < today;
      const isSelected = selectedDates.has(opt.id);
      const holiday = isPolishHoliday(opt.date);
      const d = new Date(opt.date + "T00:00:00");
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      let bgColor: string;
      if (isPast) {
        bgColor = COLORS.past;
      } else if (isSelected) {
        bgColor = COLORS.selected;
      } else if (holiday) {
        bgColor = COLORS.holiday;
      } else if (opt.is_custom) {
        bgColor = COLORS.custom;
      } else if (isWeekend) {
        bgColor = COLORS.weekend;
      } else {
        bgColor = "#e7e5e4";
      }

      marks[opt.date] = {
        customStyles: {
          container: {
            backgroundColor: bgColor,
            borderRadius: 8,
            ...(isSelected && !isPast
              ? { borderWidth: 2, borderColor: COLORS.selectedBorder }
              : {}),
            ...(isPast ? { opacity: 0.45 } : {}),
          },
          text: {
            color: isPast
              ? "#a8a29e"
              : isSelected
                ? "#78350f"
                : holiday
                  ? "#fff"
                  : opt.is_custom
                    ? "#fff"
                    : COLORS.defaultText,
            fontWeight: isSelected ? "bold" : ("normal" as const),
          },
        },
      };
    }

    return marks;
  }, [dateOptions, selectedDates, today]);

  const voterCountForDate = useCallback(
    (dateStr: string): number => {
      const opt = dateOptionMap.get(dateStr);
      if (!opt) return 0;
      return (dateVoters.get(opt.id) ?? []).length;
    },
    [dateOptionMap, dateVoters]
  );

  const handleDayPress = useCallback(
    (day: DateData) => {
      if (disabled) return;
      const dateStr = day.dateString;
      if (dateStr < today) return;

      const opt = dateOptionMap.get(dateStr);
      if (opt) {
        onToggleDate(opt.id);
      } else {
        if (
          dateRange &&
          (dateStr < dateRange.min || dateStr > dateRange.max)
        ) {
          return;
        }
        Alert.alert(
          t("survey.addCustomDateTitle"),
          t("survey.addCustomDateConfirm", {
            date: formatDateDisplay(dateStr, locale),
          }),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("common.add"),
              onPress: () => onAddCustomDate(dateStr),
            },
          ]
        );
      }
    },
    [
      disabled,
      today,
      dateOptionMap,
      dateRange,
      onToggleDate,
      onAddCustomDate,
      t,
      locale,
    ]
  );

  const handleDayLongPress = useCallback(
    (day: DateData) => {
      const opt = dateOptionMap.get(day.dateString);
      if (!opt) return;
      const voters = dateVoters.get(opt.id) ?? [];
      setVoterModal({ visible: true, dateStr: day.dateString, voters });
    },
    [dateOptionMap, dateVoters]
  );

  const renderDayComponent = useCallback(
    ({ date, marking, state }: any) => {
      if (!date) return <Box style={styles.dayCell} />;
      const dateStr: string = date.dateString;
      const customStyles = marking?.customStyles;
      const isDisabled = state === "disabled";
      const isToday = dateStr === today;
      const opt = dateOptionMap.get(dateStr);
      const count = voterCountForDate(dateStr);

      const containerStyle = [
        styles.dayCell,
        isToday && !customStyles && styles.todayCell,
        customStyles?.container,
      ];
      const textStyle = [
        styles.dayText,
        isDisabled && styles.disabledText,
        isToday && !customStyles && styles.todayText,
        customStyles?.text,
      ];

      return (
        <RNPressable
          onPress={() => handleDayPress(date)}
          onLongPress={() => handleDayLongPress(date)}
          disabled={disabled}
          style={containerStyle}
        >
          <Text style={textStyle}>{date.day}</Text>
          {opt && count > 0 && (
            <Box style={styles.voterBadge}>
              <Text style={styles.voterBadgeText}>{count}</Text>
            </Box>
          )}
        </RNPressable>
      );
    },
    [
      today,
      dateOptionMap,
      voterCountForDate,
      handleDayPress,
      handleDayLongPress,
      disabled,
    ]
  );

  return (
    <VStack space="sm">
      <Legend />
      <Calendar
        current={initialMonth}
        markingType="custom"
        markedDates={markedDates}
        dayComponent={renderDayComponent}
        firstDay={1}
        enableSwipeMonths
        theme={{
          backgroundColor: "#fafaf9",
          calendarBackground: "#fafaf9",
          monthTextColor: "#44403c",
          textMonthFontWeight: "bold",
          textMonthFontSize: 16,
          arrowColor: "#78716c",
          textSectionTitleColor: "#78716c",
          textDayHeaderFontSize: 12,
          textDayHeaderFontWeight: "600",
        }}
      />
      <Text size="xs" className="text-stone-400 text-center mt-1 italic">
        {t("survey.longPressHint")}
      </Text>

      <VoterModal
        visible={voterModal.visible}
        onClose={() =>
          setVoterModal((s) => ({ ...s, visible: false }))
        }
        dateStr={voterModal.dateStr}
        voters={voterModal.voters}
        avatarUrls={avatarUrls}
        locale={locale}
      />
    </VStack>
  );
};

const styles = StyleSheet.create({
  dayCell: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  todayCell: {
    backgroundColor: COLORS.today,
    borderRadius: 8,
  },
  dayText: {
    fontSize: 14,
    color: COLORS.defaultText,
  },
  todayText: {
    fontWeight: "bold",
    color: "#92400e",
  },
  disabledText: {
    color: COLORS.disabledText,
  },
  voterBadge: {
    position: "absolute",
    top: 1,
    right: 1,
    backgroundColor: "#44403c",
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  voterBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "bold",
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendDotBorder: {
    borderWidth: 1.5,
    borderColor: COLORS.selectedBorder,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 32,
    minWidth: 260,
    maxHeight: "70%",
  },
});

export default React.memo(CalendarDatePicker);
