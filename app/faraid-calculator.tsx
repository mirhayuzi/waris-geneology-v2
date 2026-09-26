import { Text, View, Pressable, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFamily } from "@/lib/family-store";
import { getDisplayName, Person } from "@/lib/types";
import { useState, useMemo } from "react";
import { exportFaraidPDF } from "@/lib/pdf-export";
import { useI18n, TranslationKey } from "@/lib/i18n";

type HeirKind = "wife" | "husband" | "father" | "mother" | "son" | "daughter";

interface HeirShare {
  person: Person;
  kind: HeirKind;
  relation: string;
  fraction: string;
  percentage: number;
  color: string;
}

function calculateFaraid(
  deceased: Person,
  allPersons: Person[],
  getSpouses: (id: string) => Person[],
  getChildren: (id: string) => Person[],
  getParents: (id: string) => Person[],
  t: (key: TranslationKey) => string,
): HeirShare[] {
  const heirs: HeirShare[] = [];
  const colors = ["#1B6B4A", "#C8963E", "#5856D6", "#FF9500", "#34C759", "#FF3B30", "#007AFF", "#AF52DE"];
  let colorIdx = 0;

  const spouses = getSpouses(deceased.id).filter((s) => s.religion === "Islam");
  const children = getChildren(deceased.id);
  const sons = children.filter((c) => c.gender === "male");
  const daughters = children.filter((c) => c.gender === "female");
  const parents = getParents(deceased.id).filter((p) => p.religion === "Islam");
  const father = parents.find((p) => p.gender === "male");
  const mother = parents.find((p) => p.gender === "female");
  const hasChildren = children.length > 0;

  // Spouse share
  for (const spouse of spouses) {
    if (deceased.gender === "male") {
      // Wife gets 1/8 if children, 1/4 if no children
      const fraction = hasChildren ? "1/8" : "1/4";
      const pct = hasChildren ? 12.5 : 25;
      heirs.push({ person: spouse, kind: "wife", relation: t("wife"), fraction, percentage: pct, color: colors[colorIdx++ % colors.length] });
    } else {
      // Husband gets 1/4 if children, 1/2 if no children
      const fraction = hasChildren ? "1/4" : "1/2";
      const pct = hasChildren ? 25 : 50;
      heirs.push({ person: spouse, kind: "husband", relation: t("husband"), fraction, percentage: pct, color: colors[colorIdx++ % colors.length] });
    }
  }

  // Father share
  if (father) {
    if (hasChildren) {
      heirs.push({ person: father, kind: "father", relation: t("father"), fraction: "1/6", percentage: 16.67, color: colors[colorIdx++ % colors.length] });
    } else {
      heirs.push({ person: father, kind: "father", relation: t("father"), fraction: t("residualAsabah"), percentage: 0, color: colors[colorIdx++ % colors.length] });
    }
  }

  // Mother share
  if (mother) {
    const fraction = hasChildren ? "1/6" : "1/3";
    const pct = hasChildren ? 16.67 : 33.33;
    heirs.push({ person: mother, kind: "mother", relation: t("mother"), fraction, percentage: pct, color: colors[colorIdx++ % colors.length] });
  }

  // Sons - Asabah (residual)
  for (const son of sons) {
    heirs.push({ person: son, kind: "son", relation: t("son"), fraction: t("residualAsabah"), percentage: 0, color: colors[colorIdx++ % colors.length] });
  }

  // Daughters
  if (sons.length === 0) {
    if (daughters.length === 1) {
      for (const d of daughters) {
        heirs.push({ person: d, kind: "daughter", relation: t("daughter"), fraction: "1/2", percentage: 50, color: colors[colorIdx++ % colors.length] });
      }
    } else if (daughters.length >= 2) {
      for (const d of daughters) {
        heirs.push({ person: d, kind: "daughter", relation: t("daughter"), fraction: t("twoThirdsShared"), percentage: 66.67 / daughters.length, color: colors[colorIdx++ % colors.length] });
      }
    }
  } else {
    // Daughters with sons get Asabah (son:daughter = 2:1)
    for (const d of daughters) {
      heirs.push({ person: d, kind: "daughter", relation: t("daughter"), fraction: t("asabahWithSons"), percentage: 0, color: colors[colorIdx++ % colors.length] });
    }
  }

  // Calculate residual for Asabah heirs
  const fixedTotal = heirs.filter((h) => h.percentage > 0).reduce((sum, h) => sum + h.percentage, 0);
  const residual = Math.max(0, 100 - fixedTotal);
  const asabahHeirs = heirs.filter((h) => h.percentage === 0);

  if (asabahHeirs.length > 0 && residual > 0) {
    // Sons get 2 shares, daughters get 1 share
    const totalShares = asabahHeirs.reduce((sum, h) => {
      if (h.kind === "son" || h.kind === "father") return sum + 2;
      return sum + 1;
    }, 0);
    for (const heir of asabahHeirs) {
      const shares = (heir.kind === "son" || heir.kind === "father") ? 2 : 1;
      heir.percentage = (shares / totalShares) * residual;
    }
  }

  return heirs;
}

export default function FaraidCalculatorScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data, getSpouses, getChildren, getParents } = useFamily();
  const { t } = useI18n();
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const muslimPersons = data.persons.filter((p) => p.religion === "Islam");
  const selectedPerson = selectedPersonId ? data.persons.find((p) => p.id === selectedPersonId) : null;

  const heirShares = useMemo(() => {
    if (!selectedPerson) return [];
    return calculateFaraid(selectedPerson, data.persons, getSpouses, getChildren, getParents, t);
  }, [selectedPersonId, data, t]);

  const totalPercentage = heirShares.reduce((sum, h) => sum + h.percentage, 0);

  return (
    <ScreenContainer className="pt-2">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 mb-4">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View className="flex-row items-center gap-1">
            <IconSymbol name="chevron.left" size={20} color={colors.primary} />
            <Text className="text-sm text-primary">{t("back")}</Text>
          </View>
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">{t("faraidCalculator")}</Text>
        <View className="w-12" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}>
        {/* Info */}
        <View className="rounded-2xl p-4 border mb-6" style={{ backgroundColor: colors.primary + "12", borderColor: colors.primary + "33" }}>
          <Text className="text-sm font-medium text-foreground mb-1">{t("faraidInfoTitle")}</Text>
          <Text className="text-xs text-muted leading-relaxed">{t("faraidInfoDesc")}</Text>
        </View>

        {/* Person Selector */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t("selectDeceased")}</Text>
        {muslimPersons.length === 0 ? (
          <View className="bg-surface rounded-2xl p-6 border border-border items-center mb-6">
            <Text className="text-sm text-muted text-center">{t("noMuslimMembers")}</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
            <View className="flex-row gap-2">
              {muslimPersons.map((person) => (
                <Pressable
                  key={person.id}
                  onPress={() => setSelectedPersonId(person.id)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                >
                  <View
                    className="px-4 py-3 rounded-xl border min-w-[100px] items-center"
                    style={{
                      backgroundColor: selectedPersonId === person.id ? colors.primary : "transparent",
                      borderColor: selectedPersonId === person.id ? colors.primary : colors.border,
                    }}
                  >
                    <Text
                      className="text-sm font-medium"
                      style={{ color: selectedPersonId === person.id ? "#fff" : colors.foreground }}
                      numberOfLines={1}
                    >
                      {person.firstName}
                    </Text>
                    <Text
                      className="text-[10px] mt-0.5"
                      style={{ color: selectedPersonId === person.id ? "rgba(255,255,255,0.7)" : colors.muted }}
                    >
                      {person.gender === "male" ? t("male") : t("female")}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Results */}
        {selectedPerson && heirShares.length > 0 && (
          <>
            <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              {t("distributionFor")} {selectedPerson.firstName}
            </Text>

            {/* Visual Bar Chart */}
            <View className="bg-surface rounded-2xl p-4 border border-border mb-4">
              <View className="flex-row h-8 rounded-lg overflow-hidden mb-3">
                {heirShares.map((heir, idx) => (
                  <View
                    key={idx}
                    style={{
                      flex: heir.percentage,
                      backgroundColor: heir.color,
                    }}
                  />
                ))}
              </View>

              {/* Legend */}
              <View className="gap-2">
                {heirShares.map((heir, idx) => (
                  <View key={idx} className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-1">
                      <View className="w-3 h-3 rounded-full" style={{ backgroundColor: heir.color }} />
                      <View className="flex-1">
                        <Text className="text-xs font-medium text-foreground">{getDisplayName(heir.person)}</Text>
                        <Text className="text-[10px] text-muted">{heir.relation}</Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className="text-xs font-semibold text-foreground">{heir.percentage.toFixed(1)}%</Text>
                      <Text className="text-[10px] text-muted">{heir.fraction}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Total */}
            <View className="bg-surface rounded-2xl p-4 border border-border mb-4">
              <View className="flex-row justify-between">
                <Text className="text-sm font-medium text-foreground">{t("totalDistributed")}</Text>
                <Text className="text-sm font-bold" style={{ color: Math.abs(totalPercentage - 100) < 1 ? colors.success : colors.warning }}>
                  {totalPercentage.toFixed(1)}%
                </Text>
              </View>
              {Math.abs(totalPercentage - 100) >= 1 && (
                <Text className="text-xs text-warning mt-1">
                  {t("remainderNote").replace("{pct}", (100 - totalPercentage).toFixed(1))}
                </Text>
              )}
            </View>

            {/* Export PDF Button */}
            <Pressable
              onPress={async () => {
                try {
                  const estateAmount = 100000; // Default example
                  const heirData = heirShares.map((h) => ({
                    heir: `${getDisplayName(h.person)} (${h.relation})`,
                    share: `${h.fraction} = ${h.percentage.toFixed(1)}%`,
                    amount: (h.percentage / 100) * estateAmount,
                  }));
                  await exportFaraidPDF(
                    data.familyName,
                    getDisplayName(selectedPerson),
                    estateAmount,
                    heirData
                  );
                } catch {
                  Alert.alert(t("faraidCalculator"), t("somethingWentWrong"));
                }
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <View className="flex-row items-center justify-center bg-primary rounded-2xl py-3.5 gap-2">
                <IconSymbol name="arrow.down.doc.fill" size={18} color="#fff" />
                <Text className="text-sm font-semibold text-white">{t("exportFaraidPDF")}</Text>
              </View>
            </Pressable>
          </>
        )}

        {selectedPerson && heirShares.length === 0 && (
          <View className="bg-surface rounded-2xl p-6 border border-border items-center">
            <Text className="text-sm text-muted text-center">
              {t("noEligibleHeirs").replace("{name}", selectedPerson.firstName)}
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
