import { Text, View, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { getDisplayName, Person } from "@/lib/types";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/dates";

interface TimelineEvent {
  id: string;
  date: string;
  sortDate: number;
  type: "birth" | "death" | "marriage";
  title: string;
  subtitle: string;
  person?: Person;
  personId?: string;
}

function PersonAvatar({ person, size, colors }: {
  person: Person;
  size: number;
  colors: ReturnType<typeof useColors>;
}) {
  if (person.photo) {
    return (
      <Image
        source={{ uri: person.photo }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }
  const bgColor = person.isAlive ? colors.primary + "20" : colors.muted + "20";
  const textColor = person.isAlive ? colors.primary : colors.muted;
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: bgColor, alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ fontWeight: "700", color: textColor, fontSize: size * 0.4 }}>
        {person.firstName.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export default function FamilyTimelineScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data, getPersonById } = useFamily();
  const { t, lang } = useI18n();

  const events = useMemo(() => {
    const list: TimelineEvent[] = [];

    // Birth events
    data.persons.forEach((p) => {
      if (p.birthDate) {
        list.push({
          id: `birth-${p.id}`,
          date: p.birthDate,
          sortDate: new Date(p.birthDate).getTime(),
          type: "birth",
          title: `${getDisplayName(p)}`,
          subtitle: p.birthPlace ? `${t("bornIn")} ${p.birthPlace}` : t("born"),
          person: p,
          personId: p.id,
        });
      }
    });

    // Death events
    data.persons.forEach((p) => {
      if (!p.isAlive && p.deathDate) {
        list.push({
          id: `death-${p.id}`,
          date: p.deathDate,
          sortDate: new Date(p.deathDate).getTime(),
          type: "death",
          title: `${getDisplayName(p)}`,
          subtitle: t("passedAway"),
          person: p,
          personId: p.id,
        });
      }
    });

    // Marriage events
    data.marriages.forEach((m) => {
      if (m.marriageDate) {
        const husband = getPersonById(m.husbandId);
        const wife = getPersonById(m.wifeId);
        if (husband && wife) {
          list.push({
            id: `marriage-${m.id}`,
            date: m.marriageDate,
            sortDate: new Date(m.marriageDate).getTime(),
            type: "marriage",
            title: `${husband.firstName} & ${wife.firstName}`,
            subtitle: t("marriage"),
            person: husband,
            personId: husband.id,
          });
        }
      }
    });

    // Sort by date descending (newest first)
    list.sort((a, b) => b.sortDate - a.sortDate);
    return list;
  }, [data, t]);

  const getEventColor = (type: string) => {
    switch (type) {
      case "birth": return colors.success;
      case "death": return colors.muted;
      case "marriage": return colors.accent;
      default: return colors.primary;
    }
  };

  const getEventIcon = (type: string): any => {
    switch (type) {
      case "birth": return "person.badge.plus";
      case "death": return "heart.fill";
      case "marriage": return "link";
      default: return "info.circle.fill";
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case "birth": return t("birth");
      case "death": return t("death");
      case "marriage": return t("marriage");
      default: return type;
    }
  };

  // Group events by year
  const groupedByYear = useMemo(() => {
    const groups: { year: string; events: TimelineEvent[] }[] = [];
    const yearMap = new Map<string, TimelineEvent[]>();

    events.forEach((e) => {
      const year = e.date.split("-")[0] || "Unknown";
      if (!yearMap.has(year)) {
        yearMap.set(year, []);
      }
      yearMap.get(year)!.push(e);
    });

    yearMap.forEach((evts, year) => {
      groups.push({ year, events: evts });
    });

    groups.sort((a, b) => parseInt(b.year) - parseInt(a.year));
    return groups;
  }, [events]);

  return (
    <ScreenContainer className="pt-2">
      {/* Header */}
      <View className="flex-row items-center px-5 mb-4 gap-3">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="flex-row items-center gap-1">
            <IconSymbol name="chevron.left" size={20} color={colors.primary} />
            <Text className="text-sm" style={{ color: colors.primary }}>{t("back")}</Text>
          </View>
        </Pressable>
        <Text className="text-xl font-bold text-foreground flex-1">{t("familyTimelineTitle")}</Text>
      </View>

      {events.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
            <IconSymbol name="clock.fill" size={32} color={colors.primary} />
          </View>
          <Text className="text-base font-semibold text-foreground mb-2 text-center">{t("noEvents")}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {groupedByYear.map((group) => (
            <View key={group.year} className="mb-6">
              {/* Year Header */}
              <View className="flex-row items-center gap-3 mb-3">
                <View className="bg-primary rounded-full px-3 py-1">
                  <Text className="text-sm font-bold text-white">{group.year}</Text>
                </View>
                <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} />
              </View>

              {/* Events */}
              {group.events.map((event, idx) => {
                const eventColor = getEventColor(event.type);
                return (
                  <Pressable
                    key={event.id}
                    onPress={() => event.personId && router.push({ pathname: "/member-profile" as any, params: { id: event.personId } })}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View className="flex-row gap-3 mb-3">
                      {/* Timeline line */}
                      <View className="items-center" style={{ width: 40 }}>
                        <View
                          className="w-8 h-8 rounded-full items-center justify-center"
                          style={{ backgroundColor: eventColor + "20" }}
                        >
                          <IconSymbol name={getEventIcon(event.type)} size={14} color={eventColor} />
                        </View>
                        {idx < group.events.length - 1 && (
                          <View className="w-0.5 flex-1 mt-1" style={{ backgroundColor: colors.border, minHeight: 20 }} />
                        )}
                      </View>

                      {/* Event card */}
                      <View className="flex-1 bg-surface rounded-xl p-3 border border-border">
                        <View className="flex-row items-center gap-2 mb-1">
                          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: eventColor + "15" }}>
                            <Text className="text-[10px] font-semibold" style={{ color: eventColor }}>
                              {getEventLabel(event.type).toUpperCase()}
                            </Text>
                          </View>
                          <Text className="text-[11px] text-muted">{formatDate(event.date, lang)}</Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                          {event.person && <PersonAvatar person={event.person} size={28} colors={colors} />}
                          <View className="flex-1">
                            <Text className="text-sm font-medium text-foreground" numberOfLines={1}>{event.title}</Text>
                            <Text className="text-xs text-muted">{event.subtitle}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
