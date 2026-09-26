import { Text, View, Pressable, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useFamily } from "@/lib/family-store";
import { useI18n } from "@/lib/i18n";
import { exportFamilyTreePDF, printFamilyTree } from "@/lib/pdf-export";
import { useState } from "react";

interface ToolCardProps {
  title: string;
  description: string;
  icon: any;
  onPress: () => void;
  color: string;
  loading?: boolean;
}

function ToolCard({ title, description, icon, onPress, color, loading }: ToolCardProps) {
  const colors = useColors();
  const { t } = useI18n();
  return (
    <Pressable onPress={loading ? undefined : onPress} style={({ pressed }) => [{ opacity: loading ? 0.5 : pressed ? 0.7 : 1 }]}>
      <View className="flex-row items-center bg-surface rounded-2xl p-4 border border-border gap-4">
        <View
          className="w-12 h-12 rounded-xl items-center justify-center"
          style={{ backgroundColor: color + "18" }}
        >
          <IconSymbol name={icon} size={26} color={color} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">{title}</Text>
          <Text className="text-xs text-muted mt-0.5">{loading ? t("generating") : description}</Text>
        </View>
        <IconSymbol name="chevron.right" size={18} color={colors.muted} />
      </View>
    </Pressable>
  );
}

export default function ToolsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data } = useFamily();
  const { t } = useI18n();
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    if (data.persons.length === 0) {
      Alert.alert(t("noDataTitle"), t("addMembersFirst"));
      return;
    }
    setExporting(true);
    try {
      await exportFamilyTreePDF(data);
    } catch (e) {
      Alert.alert(t("exportFamilyTreePDF"), t("somethingWentWrong"));
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    if (data.persons.length === 0) {
      Alert.alert(t("noDataTitle"), t("addMembersFirst"));
      return;
    }
    try {
      await printFamilyTree(data);
    } catch (e) {
      Alert.alert(t("printFamilyTree"), t("somethingWentWrong"));
    }
  };

  return (
    <ScreenContainer className="px-5 pt-2">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-foreground mb-1">{t("tools")}</Text>
        <Text className="text-sm text-muted mb-6">{t("powerfulFeatures")}</Text>

        {/* Islamic Tools Section */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{t("islamicTools")}</Text>
        <View className="gap-3 mb-6">
          <ToolCard
            title={t("faraidCalculator")}
            description={t("calcIslamicInheritance")}
            icon="chart.pie.fill"
            color={colors.primary}
            onPress={() => router.push("/faraid-calculator" as any)}
          />
          <ToolCard
            title={t("mahramChecker")}
            description={t("checkMahramRelationships")}
            icon="person.2.fill"
            color={colors.accent}
            onPress={() => router.push("/mahram-checker" as any)}
          />
        </View>

        {/* Views Section */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
          {t("familyTree")}
        </Text>
        <View className="gap-3 mb-6">
          <ToolCard
            title={t("familyTimeline")}
            description={t("viewChronologicalEvents")}
            icon="clock.fill"
            color="#FF6B35"
            onPress={() => router.push("/family-timeline" as any)}
          />
          <ToolCard
            title={t("millerView")}
            description={t("selectMember")}
            icon="list.bullet"
            color="#5856D6"
            onPress={() => router.push("/miller-columns" as any)}
          />
        </View>

        {/* Export & Print Section */}
        <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{t("exportPrint")}</Text>
        <View className="gap-3 mb-6">
          <ToolCard
            title={t("exportFamilyTreePDF")}
            description={t("generatePrintableReport")}
            icon="arrow.down.doc.fill"
            color="#E65100"
            onPress={handleExportPDF}
            loading={exporting}
          />
          <ToolCard
            title={t("printFamilyTree")}
            description={t("printDirectly")}
            icon="doc.text.fill"
            color="#FF9500"
            onPress={handlePrint}
          />
        </View>

        {/* Info Card */}
        <View className="bg-primary/8 rounded-2xl p-4 border border-primary/20">
          <View className="flex-row items-start gap-3">
            <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground mb-1">{t("aboutFaraid")}</Text>
              <Text className="text-xs text-muted leading-relaxed">{t("aboutFaraidDesc")}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
