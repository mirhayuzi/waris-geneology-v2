import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Text } from "@/components/Text";
import { PersonList } from "@/components/PersonPicker";
import { IconButton, Screen } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

export default function PeopleScreen() {
  const c = useColors();
  const { search } = useLocalSearchParams<{ search?: string }>();
  const { graph, t } = useStore();
  const people = graph.snapshot.persons;
  return (
    <Screen title={t("people")} back right={<IconButton icon="person-add-alt" label={t("addPerson")} color={c.primary} onPress={() => router.push("/edit")} />}>
      <PersonList
        people={people}
        autoFocus={search === "1"}
        onPick={(p) => router.push(`/person/${p.id}`)}
        header={
          <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
            <Text style={{ color: c.muted, fontSize: 13 }}>{t("stats", { p: people.length, c: graph.snapshot.unions.length })}</Text>
          </View>
        }
      />
    </Screen>
  );
}
