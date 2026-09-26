import { Text, Pressable, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useFamily } from "@/lib/family-store";
import { useI18n } from "@/lib/i18n";
import { useState, useMemo, useEffect } from "react";
import {
  MemberFormFields, MemberFormHeader, MemberLink,
  emptyMemberForm, memberFormFromPerson, memberFormToPerson,
} from "@/components/member-form";

export default function EditMemberScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPersonById, updatePerson, data, addParentChild, addMarriage, deleteParentChild, deleteMarriage } = useFamily();
  const { t } = useI18n();

  const person = getPersonById(id || "");

  const [values, setValues] = useState(() => (person ? memberFormFromPerson(person) : emptyMemberForm()));

  // Build existing relationship links from data
  const existingLinks = useMemo(() => {
    if (!id) return [];
    const links: MemberLink[] = [];

    // Parents of this person
    data.parentChildren
      .filter((pc) => pc.childId === id)
      .forEach((pc) => links.push({ type: "parent", personId: pc.parentId }));

    // Children of this person
    data.parentChildren
      .filter((pc) => pc.parentId === id)
      .forEach((pc) => links.push({ type: "child", personId: pc.childId }));

    // Spouses of this person
    data.marriages
      .filter((m) => m.husbandId === id || m.wifeId === id)
      .forEach((m) => {
        const spouseId = m.husbandId === id ? m.wifeId : m.husbandId;
        links.push({ type: "spouse", personId: spouseId });
      });

    return links;
  }, [id, data.parentChildren, data.marriages]);

  const [links, setLinks] = useState(existingLinks);

  // If family data finished loading after the first render (e.g. opened via a deep link), fill the form once
  const [filled, setFilled] = useState(!!person);
  useEffect(() => {
    if (!filled && person) {
      setValues(memberFormFromPerson(person));
      setLinks(existingLinks);
      setFilled(true);
    }
  }, [filled, person, existingLinks]);

  if (!person) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-foreground">{t("personNotFound")}</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <Text className="text-primary mt-4">{t("goBack")}</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const handleSave = () => {
    if (!values.firstName.trim()) {
      Alert.alert(t("required"), t("enterFirstName"));
      return;
    }

    updatePerson({
      ...person,
      ...memberFormToPerson(values),
    });

    // Sync relationship links: remove old, add new
    // Remove old parent-child where this person is child
    data.parentChildren
      .filter((pc) => pc.childId === id)
      .forEach((pc) => {
        if (!links.some((l) => l.type === "parent" && l.personId === pc.parentId)) {
          deleteParentChild(pc.id);
        }
      });
    // Remove old parent-child where this person is parent
    data.parentChildren
      .filter((pc) => pc.parentId === id)
      .forEach((pc) => {
        if (!links.some((l) => l.type === "child" && l.personId === pc.childId)) {
          deleteParentChild(pc.id);
        }
      });
    // Remove old marriages
    data.marriages
      .filter((m) => m.husbandId === id || m.wifeId === id)
      .forEach((m) => {
        const spouseId = m.husbandId === id ? m.wifeId : m.husbandId;
        if (!links.some((l) => l.type === "spouse" && l.personId === spouseId)) {
          deleteMarriage(m.id);
        }
      });

    // Add new links
    for (const link of links) {
      if (link.type === "parent") {
        const exists = data.parentChildren.some((pc) => pc.parentId === link.personId && pc.childId === id);
        if (!exists) addParentChild({ parentId: link.personId, childId: id!, type: "biological" });
      } else if (link.type === "child") {
        const exists = data.parentChildren.some((pc) => pc.parentId === id && pc.childId === link.personId);
        if (!exists) addParentChild({ parentId: id!, childId: link.personId, type: "biological" });
      } else if (link.type === "spouse") {
        const exists = data.marriages.some(
          (m) => (m.husbandId === id && m.wifeId === link.personId) || (m.wifeId === id && m.husbandId === link.personId)
        );
        if (!exists) {
          const husbandId = values.gender === "male" ? id! : link.personId;
          const wifeId = values.gender === "female" ? id! : link.personId;
          addMarriage({ husbandId, wifeId, isActive: true, notes: undefined });
        }
      }
    }

    router.back();
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5 pt-2">
      <MemberFormHeader title={t("editMember")} onCancel={() => router.back()} onSave={handleSave} />
      <MemberFormFields
        key={filled ? "filled" : "empty"}
        values={values}
        onChange={setValues}
        persons={data.persons}
        currentPersonId={person.id}
        links={links}
        onLinksChange={setLinks}
        onSave={handleSave}
      />
    </ScreenContainer>
  );
}
