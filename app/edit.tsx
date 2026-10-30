import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { FatherField } from "@/components/FatherField";
import { PersonPicker } from "@/components/PersonPicker";
import { PhotoCropper } from "@/components/PhotoCropper";
import { Sheet, SheetItem } from "@/components/Sheet";
import { Button, Choice, Field, goHome, Icon, IconButton, Muted, Screen } from "@/components/ui";
import { checkParent, makePerson, type Role, RuleError, suggestFatherName } from "@/lib/actions";
import { parseInput, toInput, yearOf } from "@/lib/dates";
import { deletePhoto, pickPhoto, photoUri, type PreparedPhoto, preparePhoto } from "@/lib/files";
import { possibleDuplicates } from "@/lib/match";
import { ETHNICITIES, fullName, type LinkKind, type Person, PREFIXES, RELIGIONS, type Sex, type UnionStatus } from "@/lib/model";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/theme";

type Form = {
  givenName: string;
  sex: Sex;
  prefix?: string;
  fatherName: string;
  surname: string;
  nickname: string;
  living: boolean;
  birthDate: string;
  birthPlace: string;
  deathDate: string;
  deathPlace: string;
  burialPlace: string;
  religion?: string;
  ethnicity?: string;
  occupation: string;
  phone: string;
  notes: string;
};

const ROLE_TITLE: Record<Role, "addFather" | "addMother" | "addSpouse" | "addChild" | "addSibling"> = {
  father: "addFather",
  mother: "addMother",
  spouse: "addSpouse",
  child: "addChild",
  sibling: "addSibling",
};

export default function EditScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ id?: string; role?: Role; of?: string }>();
  const store = useStore();
  const { graph, t } = store;
  const editing = params.id ? graph.get(params.id) : undefined;
  const role = !editing && params.role && params.of ? params.role : undefined;
  const base = role ? graph.get(params.of) : undefined;

  // For a child: which partner is the other parent
  const partners = useMemo(() => (base ? graph.partners(base.id) : []), [graph, base]);
  const [otherParent, setOtherParent] = useState<string | undefined>(partners.length === 1 ? partners[0].id : partners[0]?.id);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [picked, setPicked] = useState<Person>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [kind, setKind] = useState<LinkKind>("birth");
  const [unionStatus, setUnionStatus] = useState<UnionStatus>("married");
  const [marriageDate, setMarriageDate] = useState("");

  const initialSex: Sex =
    editing?.sex ?? (role === "father" ? "male" : role === "mother" ? "female" : role === "spouse" && base ? (base.sex === "male" ? "female" : "male") : "male");

  const [f, setF] = useState<Form>(() => ({
    givenName: editing?.givenName ?? "",
    sex: initialSex,
    prefix: editing?.prefix,
    fatherName: editing?.fatherName ?? (role ? (suggestFatherName(graph, { role, of: params.of!, otherParentId: otherParent }) ?? "") : ""),
    surname: editing?.surname ?? (role === "child" || role === "sibling" ? (base?.surname ?? "") : ""),
    nickname: editing?.nickname ?? "",
    living: editing?.living ?? true,
    birthDate: toInput(editing?.birthDate),
    birthPlace: editing?.birthPlace ?? "",
    deathDate: toInput(editing?.deathDate),
    deathPlace: editing?.deathPlace ?? "",
    burialPlace: editing?.burialPlace ?? "",
    religion: editing?.religion ?? base?.religion,
    ethnicity: editing?.ethnicity ?? (role === "child" || role === "sibling" ? base?.ethnicity : undefined),
    occupation: editing?.occupation ?? "",
    phone: editing?.phone ?? "",
    notes: editing?.notes ?? "",
  }));
  // Father picked from the tree in the bin/binti field, and which of his wives is the mother
  const treeFather = editing ? graph.father(editing.id) : undefined;
  const treeMother = editing ? graph.mother(editing.id) : undefined;
  const canLinkFather = !treeFather && role !== "child" && role !== "sibling";
  const [fatherLink, setFatherLink] = useState<Person>();
  const fatherWives = useMemo(() => (fatherLink ? graph.partners(fatherLink.id) : []), [graph, fatherLink]);
  const [motherId, setMotherId] = useState<string>();
  const linkFather = (p: Person) => {
    setFatherLink(p);
    const wives = graph.partners(p.id);
    setMotherId(wives.length === 1 ? wives[0].id : undefined);
  };
  const initial = useRef(JSON.stringify(f));

  const [photo, setPhoto] = useState<{ uri: string; mime?: string | null } | null | undefined>(undefined); // undefined = unchanged
  const [photoMenu, setPhotoMenu] = useState(false);
  const [cropping, setCropping] = useState<PreparedPhoto | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [more, setMore] = useState(!!editing && !!(editing.prefix || editing.religion || editing.ethnicity || editing.occupation || editing.notes || editing.nickname || editing.surname));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const ask = (heading: string, body: string, okLabel: string) =>
    new Promise<boolean>((resolve) =>
      Alert.alert(
        heading,
        body,
        [
          { text: t("cancel"), style: "cancel", onPress: () => resolve(false) },
          { text: okLabel, onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      ),
    );
  const dirty = JSON.stringify(f) !== initial.current || photo !== undefined || !!fatherLink || !!picked;
  const onHome = async () => {
    if (!dirty || (await ask(t("leaveQ"), "", t("leave")))) goHome();
  };

  const title = editing ? t("edit") : role ? t(ROLE_TITLE[role]) : t("addPerson");
  const parentRole = role === "father" || role === "mother" || role === "child" || role === "sibling";

  const shownPhoto = photo === undefined ? photoUri(editing?.photo) : photo?.uri;

  // Pick (gallery / camera) or re-adjust the current photo, then crop it in a circle
  const startPhoto = async (how: "gallery" | "camera" | "adjust") => {
    setPhotoMenu(false);
    setPhotoBusy(true);
    try {
      const p = how === "adjust" ? (shownPhoto ? await preparePhoto(shownPhoto) : null) : await pickPhoto(how);
      if (p) setCropping(p);
    } catch (e) {
      Alert.alert(t("photo"), t("somethingWrong", { msg: String((e as Error)?.message ?? e) }));
    } finally {
      setPhotoBusy(false);
    }
  };

  const changeOtherParent = (id: string | undefined) => {
    setOtherParent(id);
    if (role === "child" && base && base.sex === "female") {
      const fn = suggestFatherName(graph, { role, of: base.id, otherParentId: id });
      set("fatherName", fn ?? "");
    }
  };

  async function onSave() {
    if (saving) return;
    const errs: Partial<Record<keyof Form, string>> = {};
    let birth: string | null = "";
    let death: string | null = "";
    let married: string | null = "";
    if (role && mode === "existing") {
      if (!picked) return Alert.alert(t("pickPerson"));
    } else {
      if (!f.givenName.trim()) errs.givenName = t("nameRequired");
      birth = parseInput(f.birthDate);
      if (birth === null) errs.birthDate = t("dateInvalid");
      death = f.living ? "" : parseInput(f.deathDate);
      if (death === null) errs.deathDate = t("dateInvalid");
    }
    if (role === "spouse") {
      married = parseInput(marriageDate);
      if (married === null) return Alert.alert(t("dateInvalid"));
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    // The father picked from the tree must be possible (no loops, no second birth father)
    const motherToLink = fatherLink && motherId && !treeMother ? motherId : undefined;
    if (fatherLink && editing) {
      try {
        checkParent(graph, fatherLink, editing.id, "birth");
        if (motherToLink) checkParent(graph, graph.get(motherToLink)!, editing.id, "birth");
      } catch (e) {
        return Alert.alert(title, e instanceof RuleError ? t(e.key, e.vars) : String(e));
      }
    }
    // Someone with this name may already be in the tree
    if (!editing && !(role && mode === "existing")) {
      const dups = possibleDuplicates(graph, { givenName: f.givenName.trim(), sex: f.sex, fatherName: f.fatherName.trim() || undefined, birthDate: birth || undefined }, fatherLink?.id);
      if (dups.length) {
        const list = dups.map((d) => `• ${fullName(d)}${yearOf(d.birthDate) ? ` (${yearOf(d.birthDate)})` : ""}`).join("\n");
        if (!(await ask(t("dupTitle"), t("dupBody", { list }), t("saveAnyway")))) return;
      }
    }

    const fields = {
      givenName: f.givenName.trim(),
      sex: f.sex,
      prefix: f.prefix || undefined,
      fatherName: f.fatherName.trim() || undefined,
      surname: f.surname.trim() || undefined,
      nickname: f.nickname.trim() || undefined,
      living: f.living,
      birthDate: birth || undefined,
      birthPlace: f.birthPlace.trim() || undefined,
      deathDate: death || undefined,
      deathPlace: f.living ? undefined : f.deathPlace.trim() || undefined,
      burialPlace: f.living ? undefined : f.burialPlace.trim() || undefined,
      religion: f.religion || undefined,
      ethnicity: f.ethnicity || undefined,
      occupation: f.occupation.trim() || undefined,
      phone: f.phone.trim() || undefined,
      notes: f.notes.trim() || undefined,
    };

    setSaving(true);
    let newPhoto: string | undefined;
    try {
      if (editing) {
        let p: Person = { ...editing, ...fields };
        if (photo !== undefined) p = await store.setPhoto(p, photo);
        await store.savePerson(p);
        if (fatherLink) await store.linkParents(p.id, fatherLink.id, motherToLink);
        router.back();
        return;
      }
      if (!role) {
        let p = makePerson(fields);
        if (photo) p = await store.setPhoto(p, photo);
        newPhoto = p.photo;
        await store.createPerson(p);
        if (fatherLink) await store.linkParents(p.id, fatherLink.id, motherToLink);
        router.back();
        return;
      }
      let personArg: { id: string } | { create: Person };
      if (mode === "existing" && picked) personArg = { id: picked.id };
      else {
        let p = makePerson(fields);
        if (photo) p = await store.setPhoto(p, photo);
        newPhoto = p.photo;
        personArg = { create: p };
      }
      const relId = await store.addRelative({
        role,
        of: base!.id,
        person: personArg,
        kind,
        otherParentId: role === "child" ? (otherParent ?? null) : undefined,
        union: role === "spouse" ? { status: unionStatus, startDate: married || undefined } : undefined,
      });
      if (fatherLink && "create" in personArg) await store.linkParents(relId, fatherLink.id, motherToLink);
      router.back();
    } catch (e) {
      if (newPhoto) await deletePhoto(newPhoto);
      const msg = e instanceof RuleError ? t(e.key, e.vars) : t("somethingWrong", { msg: String((e as Error)?.message ?? e) });
      Alert.alert(title, msg);
    } finally {
      setSaving(false);
    }
  }

  const sexOptions = [
    { value: "male" as Sex, label: t("male") },
    { value: "female" as Sex, label: t("female") },
  ];

  return (
    <Screen title={title} back onHome={onHome} right={<IconButton icon="check" label={t("save")} onPress={onSave} color={c.primary} />}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {base ? (
            <Muted style={{ marginBottom: 12 }}>
              {t(ROLE_TITLE[role!])} — {fullName(base)}
            </Muted>
          ) : null}

          {role ? (
            <Choice
              value={mode}
              onChange={(v) => setMode(v ?? "new")}
              options={[
                { value: "new", label: t("newPerson") },
                { value: "existing", label: t("existingPerson") },
              ]}
            />
          ) : null}

          {role === "child" && partners.length > 0 ? (
            <Choice
              label={t("otherParent")}
              value={otherParent ?? "none"}
              onChange={(v) => changeOtherParent(v === "none" || !v ? undefined : v)}
              options={[...partners.map((p) => ({ value: p.id, label: p.givenName })), { value: "none", label: t("unknown") }]}
            />
          ) : null}

          {role && mode === "existing" ? (
            <Pressable onPress={() => setPickerOpen(true)} style={[styles.pick, { borderColor: c.border, backgroundColor: c.surface }]}>
              {picked ? <Avatar person={picked} size={44} /> : <Icon name="person-search" size={32} color={c.primary} />}
              <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{picked ? fullName(picked) : t("pickPerson")}</Text>
              <Icon name="chevron-right" color={c.muted} />
            </Pressable>
          ) : (
            <>
              <View style={styles.photoRow}>
                <Pressable onPress={() => setPhotoMenu(true)} disabled={photoBusy}>
                  {shownPhoto ? (
                    <Avatar person={{ ...(editing ?? makePerson({ givenName: "", sex: f.sex, living: true })), photo: shownPhoto }} size={84} />
                  ) : (
                    <Avatar sex={f.sex} size={84} />
                  )}
                  <View style={[styles.camera, { backgroundColor: c.primary }]}>
                    <Icon name="photo-camera" size={16} color="#fff" />
                  </View>
                </Pressable>
                <View style={{ flex: 1, gap: 6 }}>
                  <Button title={t("choosePhoto")} kind="secondary" onPress={() => setPhotoMenu(true)} disabled={photoBusy} />
                  {shownPhoto ? <Button title={t("adjustPhoto")} kind="plain" icon="crop" onPress={() => startPhoto("adjust")} disabled={photoBusy} /> : null}
                </View>
              </View>

              <Field label={`${t("givenName")} *`} value={f.givenName} onChangeText={(v) => set("givenName", v)} placeholder={t("givenNameHint")} error={errors.givenName} autoCapitalize="words" />
              <Choice label={t("sex")} value={f.sex} onChange={(v) => v && set("sex", v)} options={sexOptions} />
              <FatherField
                sex={f.sex}
                value={f.fatherName}
                onChangeText={(v) => set("fatherName", v)}
                linked={fatherLink}
                onLink={linkFather}
                onUnlink={() => {
                  setFatherLink(undefined);
                  setMotherId(undefined);
                }}
                canLink={canLinkFather}
                childId={editing?.id}
                treeFather={treeFather}
              />
              {fatherLink && fatherWives.length && !treeMother ? (
                <Choice
                  label={t("motherOf", { name: fatherLink.givenName })}
                  value={motherId ?? "none"}
                  onChange={(v) => setMotherId(v === "none" || !v ? undefined : v)}
                  options={[...fatherWives.map((w) => ({ value: w.id, label: w.givenName })), { value: "none", label: t("unknown") }]}
                />
              ) : null}

              <View style={styles.switchRow}>
                <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{t("living")}</Text>
                <Switch value={f.living} onValueChange={(v) => set("living", v)} trackColor={{ true: c.primary }} />
              </View>
              <Field label={t("birthDate")} value={f.birthDate} onChangeText={(v) => set("birthDate", v)} placeholder="12/3/1982" hint={t("dateHint")} error={errors.birthDate} keyboardType="numbers-and-punctuation" />
              <Field label={t("birthPlace")} value={f.birthPlace} onChangeText={(v) => set("birthPlace", v)} autoCapitalize="words" />
              {!f.living ? (
                <>
                  <Field label={t("deathDate")} value={f.deathDate} onChangeText={(v) => set("deathDate", v)} hint={t("dateHint")} error={errors.deathDate} keyboardType="numbers-and-punctuation" />
                  <Field label={t("deathPlace")} value={f.deathPlace} onChangeText={(v) => set("deathPlace", v)} autoCapitalize="words" />
                  <Field label={t("burialPlace")} value={f.burialPlace} onChangeText={(v) => set("burialPlace", v)} autoCapitalize="words" />
                </>
              ) : null}

              <Pressable onPress={() => setMore(!more)} style={styles.moreBtn}>
                <Text style={{ color: c.primary, fontSize: 15, fontWeight: "600" }}>{more ? t("fewerDetails") : t("moreDetails")}</Text>
                <Icon name={more ? "expand-less" : "expand-more"} color={c.primary} />
              </Pressable>
              {more ? (
                <>
                  <Choice label={t("prefix")} value={f.prefix} onChange={(v) => set("prefix", v)} allowNone options={PREFIXES.map((p) => ({ value: p, label: p }))} />
                  <Field label={t("nickname")} value={f.nickname} onChangeText={(v) => set("nickname", v)} />
                  <Field label={t("surname")} value={f.surname} onChangeText={(v) => set("surname", v)} />
                  <Choice label={t("religion")} value={f.religion} onChange={(v) => set("religion", v)} allowNone options={RELIGIONS.map((r) => ({ value: r, label: r }))} />
                  <Choice label={t("ethnicity")} value={f.ethnicity} onChange={(v) => set("ethnicity", v)} allowNone options={ETHNICITIES.map((r) => ({ value: r, label: r }))} />
                  <Field label={t("occupation")} value={f.occupation} onChangeText={(v) => set("occupation", v)} />
                  <Field label={t("phone")} value={f.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" />
                  <Field label={t("notes")} value={f.notes} onChangeText={(v) => set("notes", v)} multiline />
                </>
              ) : null}
            </>
          )}

          {parentRole ? (
            <Choice
              label={t("linkKind")}
              value={kind}
              onChange={(v) => setKind(v ?? "birth")}
              options={(["birth", "adopted", "step", "foster", "milk"] as LinkKind[]).map((k) => ({ value: k, label: t(`kind_${k}`) }))}
            />
          ) : null}
          {role === "spouse" ? (
            <>
              <Choice
                label={t("marriage")}
                value={unionStatus}
                onChange={(v) => setUnionStatus(v ?? "married")}
                options={(["married", "divorced", "widowed"] as UnionStatus[]).map((s) => ({ value: s, label: t(`status_${s}`) }))}
              />
              <Field label={t("marriageDate")} value={marriageDate} onChangeText={setMarriageDate} hint={t("dateHint")} keyboardType="numbers-and-punctuation" />
            </>
          ) : null}

          <Button title={t("save")} onPress={onSave} disabled={saving} style={{ marginTop: 8 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      <PersonPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={setPicked} exclude={base ? [base.id] : []} />
      <Sheet visible={photoMenu} onClose={() => setPhotoMenu(false)} title={t("photo")}>
        <SheetItem icon="photo-library" label={t("fromGallery")} onPress={() => startPhoto("gallery")} />
        <SheetItem icon="photo-camera" label={t("fromCamera")} onPress={() => startPhoto("camera")} />
        {shownPhoto ? <SheetItem icon="crop" label={t("adjustPhoto")} onPress={() => startPhoto("adjust")} /> : null}
        {shownPhoto ? (
          <SheetItem
            icon="delete-outline"
            label={t("removePhoto")}
            color={c.danger}
            onPress={() => {
              setPhotoMenu(false);
              setPhoto(null);
            }}
          />
        ) : null}
      </Sheet>
      <PhotoCropper
        photo={cropping}
        onCancel={() => setCropping(null)}
        onDone={(uri) => {
          setCropping(null);
          setPhoto({ uri, mime: "image/jpeg" });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 60 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  camera: { position: "absolute", right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  switchRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  moreBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 10, marginBottom: 6 },
  pick: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderRadius: 12, marginBottom: 14 },
});
