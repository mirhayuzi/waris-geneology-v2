import { Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useFamily } from "@/lib/family-store";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import {
  MemberFormFields, MemberFormHeader, MemberLink,
  emptyMemberForm, memberFormToPerson,
} from "@/components/member-form";

export default function AddMemberScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ parentId?: string; spouseId?: string; childOfId?: string }>();
  const { addPerson, addParentChild, addMarriage, data, setRootPerson } = useFamily();
  const { t } = useI18n();

  const [values, setValues] = useState(emptyMemberForm);
  const [links, setLinks] = useState<MemberLink[]>(() => {
    const initial: MemberLink[] = [];
    if (params.parentId) initial.push({ type: "parent", personId: params.parentId });
    if (params.spouseId) initial.push({ type: "spouse", personId: params.spouseId });
    if (params.childOfId) initial.push({ type: "child", personId: params.childOfId });
    return initial;
  });

  const handleSave = () => {
    if (!values.firstName.trim()) {
      Alert.alert(t("required"), t("enterFirstName"));
      return;
    }

    const person = addPerson({
      ...memberFormToPerson(values),
      deathPlace: undefined,
      icNumber: undefined,
    });

    // Set as root if first person
    if (data.persons.length === 0) {
      setRootPerson(person.id);
    }

    // Process relationship links
    for (const link of links) {
      if (link.type === "parent") {
        addParentChild({ parentId: link.personId, childId: person.id, type: "biological" });
      } else if (link.type === "child") {
        addParentChild({ parentId: person.id, childId: link.personId, type: "biological" });
      } else if (link.type === "spouse") {
        const spousePerson = data.persons.find((p) => p.id === link.personId);
        if (spousePerson) {
          const husbandId = values.gender === "male" ? person.id : link.personId;
          const wifeId = values.gender === "female" ? person.id : link.personId;
          addMarriage({ husbandId, wifeId, isActive: true, notes: undefined });
        }
      }
    }

    router.back();
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5 pt-2">
      <MemberFormHeader title={t("addMember")} onCancel={() => router.back()} onSave={handleSave} />
      <MemberFormFields
        values={values}
        onChange={setValues}
        persons={data.persons}
        links={links}
        onLinksChange={setLinks}
        onSave={handleSave}
      />
    </ScreenContainer>
  );
}
