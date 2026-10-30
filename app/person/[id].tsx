import { router, useLocalSearchParams } from "expo-router";
import { ProfileView } from "@/components/ProfileView";
import { IconButton, Screen } from "@/components/ui";
import { useStore } from "@/lib/store";

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { graph, t } = useStore();
  const p = graph.get(id);
  return (
    <Screen
      title={p?.givenName ?? ""}
      back
      right={p ? <IconButton icon="edit" label={t("edit")} onPress={() => router.push({ pathname: "/edit", params: { id: p.id } })} /> : undefined}
    >
      <ProfileView id={id} />
    </Screen>
  );
}
