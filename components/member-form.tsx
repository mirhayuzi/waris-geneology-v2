import { Text, View, Pressable, ScrollView, TextInput, Modal, FlatList, Platform, Alert } from "react-native";
import { Image } from "expo-image";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Gender, Religion, PREFIXES, ETHNICITIES, RELIGIONS, Person, getDisplayName } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useState, useCallback } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

// ---- Shared Form Components ----

export function FormLabel({ text }: { text: string }) {
  return <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">{text}</Text>;
}

export function FormInput({ value, onChangeText, placeholder, multiline, editable }: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
  editable?: boolean;
}) {
  const colors = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      editable={editable}
      className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground mb-4"
      style={{ color: colors.foreground, minHeight: multiline ? 80 : undefined }}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
    />
  );
}

export function ChipSelector({ options, selected, onSelect }: {
  options: readonly string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  const colors = useColors();
  return (
    <View className="flex-row flex-wrap gap-2 mb-4">
      {options.map((opt) => (
        <Pressable key={opt} onPress={() => onSelect(opt)} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
          <View
            className="px-3 py-1.5 rounded-full border"
            style={{
              backgroundColor: selected === opt ? colors.primary : "transparent",
              borderColor: selected === opt ? colors.primary : colors.border,
            }}
          >
            <Text className="text-xs font-medium" style={{ color: selected === opt ? "#fff" : colors.foreground }}>
              {opt}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ---- Dropdown Selector ----

export function DropdownSelector({ label, options, selected, onSelect, placeholder }: {
  label: string;
  options: readonly string[];
  selected: string;
  onSelect: (v: string) => void;
  placeholder: string;
}) {
  const colors = useColors();
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <FormLabel text={label} />
      <Pressable onPress={() => setVisible(true)} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <View className="bg-surface border border-border rounded-xl px-4 py-3 mb-4 flex-row items-center justify-between">
          <Text className="text-sm" style={{ color: selected ? colors.foreground : colors.muted }}>
            {selected || placeholder}
          </Text>
          <IconSymbol name="chevron.right" size={14} color={colors.muted} />
        </View>
      </Pressable>

      <Modal visible={visible} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => setVisible(false)}
        >
          <Pressable style={{ maxHeight: "60%" }}>
            <View className="bg-background rounded-t-3xl" style={{ paddingBottom: Platform.OS === "ios" ? 34 : 20 }}>
              <View className="items-center py-3">
                <View className="w-10 h-1 rounded-full bg-border" />
              </View>
              <Text className="text-base font-semibold text-foreground px-5 mb-3">{label}</Text>

              {/* None / Clear option */}
              <Pressable
                onPress={() => { onSelect(""); setVisible(false); }}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View className="px-5 py-3 flex-row items-center justify-between border-b border-border">
                  <Text className="text-sm text-muted italic">{t("none")}</Text>
                  {!selected && <IconSymbol name="checkmark" size={16} color={colors.primary} />}
                </View>
              </Pressable>

              <FlatList
                data={options}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => { onSelect(item); setVisible(false); }}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View className="px-5 py-3 flex-row items-center justify-between border-b border-border">
                      <Text className="text-sm text-foreground">{item}</Text>
                      {selected === item && <IconSymbol name="checkmark" size={16} color={colors.primary} />}
                    </View>
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ---- Date Picker ----

const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"],
  bm: ["Januari", "Februari", "Mac", "April", "Mei", "Jun",
    "Julai", "Ogos", "September", "Oktober", "November", "Disember"],
};

export function DatePickerField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const colors = useColors();
  const { t, lang } = useI18n();
  const [visible, setVisible] = useState(false);

  // Parse existing value
  const parsed = value ? parseDateString(value) : null;
  const [selYear, setSelYear] = useState(parsed?.year || new Date().getFullYear());
  const [selMonth, setSelMonth] = useState(parsed?.month || 1);
  const [selDay, setSelDay] = useState(parsed?.day || 1);

  const years: number[] = [];
  for (let y = new Date().getFullYear(); y >= 1900; y--) years.push(y);

  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const days: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const handleConfirm = () => {
    const mm = String(selMonth).padStart(2, "0");
    const dd = String(Math.min(selDay, daysInMonth)).padStart(2, "0");
    onChange(`${selYear}-${mm}-${dd}`);
    setVisible(false);
  };

  const handleClear = () => {
    onChange("");
    setVisible(false);
  };

  return (
    <>
      <FormLabel text={label} />
      <Pressable onPress={() => setVisible(true)} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <View className="bg-surface border border-border rounded-xl px-4 py-3 mb-4 flex-row items-center justify-between">
          <Text className="text-sm" style={{ color: value ? colors.foreground : colors.muted }}>
            {value || t("tapToSelectDate")}
          </Text>
          <IconSymbol name="calendar" size={16} color={colors.muted} />
        </View>
      </Pressable>

      <Modal visible={visible} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => setVisible(false)}
        >
          <Pressable>
            <View className="bg-background rounded-t-3xl pb-8">
              <View className="items-center py-3">
                <View className="w-10 h-1 rounded-full bg-border" />
              </View>
              <Text className="text-base font-semibold text-foreground px-5 mb-4">{label}</Text>

              {/* Year / Month / Day selectors */}
              <View className="flex-row px-5 gap-2 mb-4">
                {/* Day */}
                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1 text-center">{t("day")}</Text>
                  <ScrollView style={{ height: 150 }} showsVerticalScrollIndicator={false}>
                    {days.map((d) => (
                      <Pressable key={d} onPress={() => setSelDay(d)}>
                        <View
                          className="py-2 rounded-lg items-center"
                          style={{ backgroundColor: selDay === d ? colors.primary + "20" : "transparent" }}
                        >
                          <Text className="text-sm font-medium" style={{ color: selDay === d ? colors.primary : colors.foreground }}>
                            {d}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Month */}
                <View className="flex-[2]">
                  <Text className="text-xs text-muted mb-1 text-center">{t("month")}</Text>
                  <ScrollView style={{ height: 150 }} showsVerticalScrollIndicator={false}>
                    {MONTHS[lang].map((m, idx) => (
                      <Pressable key={m} onPress={() => setSelMonth(idx + 1)}>
                        <View
                          className="py-2 rounded-lg items-center"
                          style={{ backgroundColor: selMonth === idx + 1 ? colors.primary + "20" : "transparent" }}
                        >
                          <Text className="text-sm font-medium" style={{ color: selMonth === idx + 1 ? colors.primary : colors.foreground }}>
                            {m}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Year */}
                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1 text-center">{t("year")}</Text>
                  <ScrollView style={{ height: 150 }} showsVerticalScrollIndicator={false}>
                    {years.map((y) => (
                      <Pressable key={y} onPress={() => setSelYear(y)}>
                        <View
                          className="py-2 rounded-lg items-center"
                          style={{ backgroundColor: selYear === y ? colors.primary + "20" : "transparent" }}
                        >
                          <Text className="text-sm font-medium" style={{ color: selYear === y ? colors.primary : colors.foreground }}>
                            {y}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Buttons */}
              <View className="flex-row px-5 gap-3">
                <Pressable onPress={handleClear} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}>
                  <View className="py-3 rounded-xl border border-border items-center">
                    <Text className="text-sm font-medium text-muted">{t("clear")}</Text>
                  </View>
                </Pressable>
                <Pressable onPress={handleConfirm} style={({ pressed }) => [{ flex: 2, opacity: pressed ? 0.8 : 1 }]}>
                  <View className="py-3 rounded-xl bg-primary items-center">
                    <Text className="text-sm font-semibold text-white">{t("confirm")}</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function parseDateString(s: string): { year: number; month: number; day: number } | null {
  const parts = s.split("-");
  if (parts.length === 3) {
    return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10), day: parseInt(parts[2], 10) };
  }
  return null;
}

// ---- Photo Picker (Using DocumentPicker - no native ImagePicker dependency) ----

async function persistPhotoFromUri(sourceUri: string): Promise<string> {
  if (Platform.OS === "web") return sourceUri;
  try {
    const docDir = FileSystem.documentDirectory;
    if (!docDir) return sourceUri;

    // Read the source as base64
    const base64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Write to app's document directory
    const fileName = `photo_${Date.now()}.jpg`;
    const destUri = `${docDir}${fileName}`;
    await FileSystem.writeAsStringAsync(destUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return destUri;
  } catch (e) {
    console.warn("persistPhoto fallback to original URI:", e);
    return sourceUri;
  }
}

export function PhotoPicker({ photo, onPhotoChange }: {
  photo: string | undefined;
  onPhotoChange: (uri: string | undefined) => void;
}) {
  const colors = useColors();
  const { t } = useI18n();
  const [showOptions, setShowOptions] = useState(false);
  const [loading, setLoading] = useState(false);

  // Use DocumentPicker to select images - this works reliably on all Android devices
  // without requiring the ExponentImagePicker native module
  const pickFromDevice = useCallback(async () => {
    setShowOptions(false);
    setLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.uri;

        if (Platform.OS === "web") {
          // On web, use the URI directly
          onPhotoChange(uri);
        } else {
          // On native, persist to app storage
          try {
            const persisted = await persistPhotoFromUri(uri);
            onPhotoChange(persisted);
          } catch {
            // Fallback: use the cache URI directly
            onPhotoChange(uri);
          }
        }
      }
    } catch (e: any) {
      console.error("Photo picker error:", e);
      Alert.alert("Error", `Failed to select photo: ${e?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [onPhotoChange]);

  const removePhoto = useCallback(() => {
    setShowOptions(false);
    onPhotoChange(undefined);
  }, [onPhotoChange]);

  return (
    <>
      <View className="items-center mb-4">
        <Pressable
          onPress={() => setShowOptions(true)}
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
        >
          {photo ? (
            <View style={{ position: "relative" }}>
              <Image
                source={{ uri: photo }}
                style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: colors.primary }}
                contentFit="cover"
              />
              <View
                style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: colors.primary,
                  alignItems: "center", justifyContent: "center",
                  borderWidth: 2, borderColor: colors.background,
                }}
              >
                <IconSymbol name="camera.fill" size={13} color="#fff" />
              </View>
            </View>
          ) : (
            <View
              style={{
                width: 96, height: 96, borderRadius: 48,
                backgroundColor: colors.primary + "15",
                borderWidth: 2, borderColor: colors.primary + "40",
                borderStyle: "dashed",
                alignItems: "center", justifyContent: "center",
              }}
            >
              {loading ? (
                <Text style={{ fontSize: 10, color: colors.muted }}>{t("loading")}</Text>
              ) : (
                <>
                  <IconSymbol name="camera.fill" size={24} color={colors.primary} />
                  <Text style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>{t("addPhoto")}</Text>
                </>
              )}
            </View>
          )}
        </Pressable>
      </View>

      <Modal visible={showOptions} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => setShowOptions(false)}
        >
          <Pressable>
            <View className="bg-background rounded-t-3xl pb-8">
              <View className="items-center py-3">
                <View className="w-10 h-1 rounded-full bg-border" />
              </View>
              <Text className="text-base font-semibold text-foreground px-5 mb-3">{t("choosePhoto")}</Text>

              <Pressable onPress={pickFromDevice} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View className="flex-row items-center px-5 py-3.5 gap-3">
                  <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary + "15" }}>
                    <IconSymbol name="photo.fill" size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">{t("chooseFromDevice")}</Text>
                    <Text className="text-xs text-muted">{t("chooseFromDeviceDesc")}</Text>
                  </View>
                </View>
              </Pressable>

              {photo && (
                <Pressable onPress={removePhoto} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                  <View className="flex-row items-center px-5 py-3.5 gap-3">
                    <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: colors.error + "15" }}>
                      <IconSymbol name="trash.fill" size={20} color={colors.error} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium" style={{ color: colors.error }}>{t("removePhoto")}</Text>
                    </View>
                  </View>
                </Pressable>
              )}

              <Pressable onPress={() => setShowOptions(false)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View className="mx-5 mt-3 py-3 rounded-xl border border-border items-center">
                  <Text className="text-sm font-medium text-muted">{t("cancel")}</Text>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ---- Relationship Link Selector ----

export function RelationshipLinkSelector({ persons, currentPersonId, selectedLinks, onLinksChange }: {
  persons: Person[];
  currentPersonId?: string;
  selectedLinks: { type: "spouse" | "parent" | "child"; personId: string }[];
  onLinksChange: (links: { type: "spouse" | "parent" | "child"; personId: string }[]) => void;
}) {
  const colors = useColors();
  const { t } = useI18n();
  const [showPicker, setShowPicker] = useState(false);
  const [linkType, setLinkType] = useState<"spouse" | "parent" | "child">("spouse");

  const availablePersons = persons.filter((p) => {
    if (currentPersonId && p.id === currentPersonId) return false;
    return !selectedLinks.some((l) => l.personId === p.id);
  });

  const addLink = (personId: string) => {
    onLinksChange([...selectedLinks, { type: linkType, personId }]);
    setShowPicker(false);
  };

  const removeLink = (personId: string) => {
    onLinksChange(selectedLinks.filter((l) => l.personId !== personId));
  };

  const getPersonName = (id: string) => {
    const p = persons.find((pp) => pp.id === id);
    return p ? getDisplayName(p) : "Unknown";
  };

  const linkTypeLabel = (type: "spouse" | "parent" | "child") => t(type);

  const linkTypeColor = (type: string) => {
    switch (type) {
      case "spouse": return colors.accent;
      case "parent": return colors.primary;
      case "child": return colors.success;
      default: return colors.muted;
    }
  };

  if (persons.filter((p) => p.id !== currentPersonId).length === 0) return null;

  return (
    <>
      <FormLabel text={t("familyConnections")} />
      <View className="bg-surface rounded-2xl border border-border p-3 mb-4">
        <Text className="text-xs text-muted mb-1">{t("connectionsHint")}</Text>
        {/* Existing links */}
        {selectedLinks.map((link) => (
          <View key={`${link.type}-${link.personId}`} className="flex-row items-center justify-between py-2 border-b border-border">
            <View className="flex-row items-center gap-2 flex-1">
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: linkTypeColor(link.type) + "20" }}>
                <Text className="text-[11px] font-semibold" style={{ color: linkTypeColor(link.type) }}>
                  {linkTypeLabel(link.type).toUpperCase()}
                </Text>
              </View>
              <Text className="text-sm text-foreground flex-1" numberOfLines={1}>{getPersonName(link.personId)}</Text>
            </View>
            <Pressable onPress={() => removeLink(link.personId)} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <View className="w-7 h-7 rounded-full bg-error/10 items-center justify-center">
                <IconSymbol name="xmark" size={12} color={colors.error} />
              </View>
            </Pressable>
          </View>
        ))}

        {/* Add link button */}
        <View className="flex-row gap-2 mt-2">
          {(["parent", "spouse", "child"] as const).map((type) => (
            <Pressable
              key={type}
              onPress={() => { setLinkType(type); setShowPicker(true); }}
              style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}
            >
              <View className="py-2.5 rounded-lg border items-center" style={{ borderColor: linkTypeColor(type) + "60" }}>
                <Text className="text-xs font-semibold" style={{ color: linkTypeColor(type) }}>
                  + {linkTypeLabel(type)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Person picker modal */}
      <Modal visible={showPicker} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => setShowPicker(false)}
        >
          <Pressable style={{ maxHeight: "60%" }}>
            <View className="bg-background rounded-t-3xl" style={{ paddingBottom: Platform.OS === "ios" ? 34 : 20 }}>
              <View className="items-center py-3">
                <View className="w-10 h-1 rounded-full bg-border" />
              </View>
              <Text className="text-base font-semibold text-foreground px-5 mb-1">
                {t("selectPersonAs")} {linkTypeLabel(linkType).toLowerCase()}
              </Text>
              <View className="mb-3" />

              {availablePersons.length === 0 ? (
                <View className="px-5 py-6 items-center">
                  <Text className="text-sm text-muted">{t("noAvailableMembers")}</Text>
                </View>
              ) : (
                <FlatList
                  data={availablePersons}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => addLink(item.id)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    >
                      <View className="flex-row items-center px-5 py-3 gap-3 border-b border-border">
                        <View
                          className="w-8 h-8 rounded-full items-center justify-center"
                          style={{ backgroundColor: colors.primary + "15" }}
                        >
                          <Text className="text-xs font-bold" style={{ color: colors.primary }}>
                            {item.firstName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-foreground">{getDisplayName(item)}</Text>
                          <Text className="text-xs text-muted">
                            {item.gender === "male" ? t("male") : t("female")} · {item.religion}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  )}
                />
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ---- Shared Add / Edit Member Form ----

export type MemberLink = { type: "spouse" | "parent" | "child"; personId: string };

export interface MemberFormValues {
  prefix: string;
  firstName: string;
  binBinti: string;
  lastName: string;
  gender: Gender;
  birthDate: string;
  birthPlace: string;
  deathDate: string;
  isAlive: boolean;
  race: string;
  religion: Religion;
  bio: string;
  photo: string | undefined;
}

export function emptyMemberForm(): MemberFormValues {
  return {
    prefix: "", firstName: "", binBinti: "", lastName: "", gender: "male",
    birthDate: "", birthPlace: "", deathDate: "", isAlive: true,
    race: "", religion: "Islam", bio: "", photo: undefined,
  };
}

export function memberFormFromPerson(p: Person): MemberFormValues {
  return {
    prefix: p.prefix || "",
    firstName: p.firstName || "",
    binBinti: p.binBinti || "",
    lastName: p.lastName || "",
    gender: p.gender || "male",
    birthDate: p.birthDate || "",
    birthPlace: p.birthPlace || "",
    deathDate: p.deathDate || "",
    isAlive: p.isAlive ?? true,
    race: p.race || "",
    religion: p.religion || "Islam",
    bio: p.bio || "",
    photo: p.photo,
  };
}

/** Converts form values into the Person fields they control (empty strings become undefined). */
export function memberFormToPerson(v: MemberFormValues) {
  return {
    prefix: v.prefix || undefined,
    firstName: v.firstName.trim(),
    binBinti: v.binBinti.trim() || undefined,
    lastName: v.lastName.trim() || undefined,
    gender: v.gender,
    birthDate: v.birthDate.trim() || undefined,
    birthPlace: v.birthPlace.trim() || undefined,
    deathDate: v.isAlive ? undefined : (v.deathDate.trim() || undefined),
    race: v.race || undefined,
    religion: v.religion,
    bio: v.bio.trim() || undefined,
    photo: v.photo || undefined,
    isAlive: v.isAlive,
  };
}

function hasExtraDetails(v: MemberFormValues) {
  return !!(v.prefix || v.lastName || v.birthPlace || v.race || v.bio || v.religion !== "Islam");
}

function TwoOptionToggle<T>({ options, value, onChange }: {
  options: { value: T; label: string; color: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const colors = useColors();
  return (
    <View className="flex-row gap-3 mb-4">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}
          >
            <View
              className="py-3 rounded-xl border items-center"
              style={{
                backgroundColor: active ? opt.color : "transparent",
                borderColor: active ? opt.color : colors.border,
              }}
            >
              <Text className="text-sm font-medium" style={{ color: active ? "#fff" : colors.foreground }}>
                {opt.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MemberFormHeader({ title, onCancel, onSave }: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
}) {
  const colors = useColors();
  const { t } = useI18n();
  return (
    <View className="flex-row items-center justify-between mb-4">
      <Pressable onPress={onCancel} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
        <View className="flex-row items-center gap-1">
          <IconSymbol name="xmark" size={20} color={colors.foreground} />
          <Text className="text-sm text-foreground">{t("cancel")}</Text>
        </View>
      </Pressable>
      <Text className="text-lg font-semibold text-foreground">{title}</Text>
      <Pressable onPress={onSave} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
        <View className="bg-primary rounded-lg px-4 py-1.5">
          <Text className="text-white text-sm font-semibold">{t("save")}</Text>
        </View>
      </Pressable>
    </View>
  );
}

export function MemberFormFields({ values, onChange, persons, currentPersonId, links, onLinksChange, onSave }: {
  values: MemberFormValues;
  onChange: (v: MemberFormValues) => void;
  persons: Person[];
  currentPersonId?: string;
  links: MemberLink[];
  onLinksChange: (links: MemberLink[]) => void;
  onSave: () => void;
}) {
  const colors = useColors();
  const { t } = useI18n();
  const [showMore, setShowMore] = useState(() => hasExtraDetails(values));
  const set = <K extends keyof MemberFormValues>(key: K, val: MemberFormValues[K]) =>
    onChange({ ...values, [key]: val });

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <PhotoPicker photo={values.photo} onPhotoChange={(uri) => set("photo", uri)} />

      {/* Essentials */}
      <FormLabel text={t("firstName")} />
      <FormInput value={values.firstName} onChangeText={(v) => set("firstName", v)} placeholder={t("firstNamePlaceholder")} />

      <FormLabel text={t("gender")} />
      <TwoOptionToggle
        options={[
          { value: "male" as Gender, label: t("male"), color: colors.primary },
          { value: "female" as Gender, label: t("female"), color: colors.primary },
        ]}
        value={values.gender}
        onChange={(v) => set("gender", v)}
      />

      <FormLabel text={`${values.gender === "male" ? t("bin") : t("binti")} ${t("fatherName")}`} />
      <FormInput value={values.binBinti} onChangeText={(v) => set("binBinti", v)} placeholder={t("fatherNamePlaceholder")} />

      <FormLabel text={t("status")} />
      <TwoOptionToggle
        options={[
          { value: true, label: t("livingStatus"), color: colors.success },
          { value: false, label: t("deceasedStatus"), color: colors.muted },
        ]}
        value={values.isAlive}
        onChange={(v) => set("isAlive", v)}
      />

      <DatePickerField label={t("dateOfBirth")} value={values.birthDate} onChange={(v) => set("birthDate", v)} />
      {!values.isAlive && (
        <DatePickerField label={t("dateOfDeath")} value={values.deathDate} onChange={(v) => set("deathDate", v)} />
      )}

      <RelationshipLinkSelector
        persons={persons}
        currentPersonId={currentPersonId}
        selectedLinks={links}
        onLinksChange={onLinksChange}
      />

      {/* Optional extras, hidden by default to keep the form short */}
      <Pressable onPress={() => setShowMore(!showMore)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
        <View className="flex-row items-center justify-between py-3 px-4 mb-4 rounded-xl border border-dashed border-border">
          <Text className="text-sm font-medium" style={{ color: colors.primary }}>
            {showMore ? t("hideDetails") : t("moreDetails")}
          </Text>
          <IconSymbol name={showMore ? "minus" : "plus"} size={18} color={colors.primary} />
        </View>
      </Pressable>

      {showMore && (
        <>
          <DropdownSelector
            label={t("prefixTitle")}
            options={PREFIXES}
            selected={values.prefix}
            onSelect={(v) => set("prefix", v)}
            placeholder={t("selectPrefix")}
          />

          <FormLabel text={t("lastName")} />
          <FormInput value={values.lastName} onChangeText={(v) => set("lastName", v)} placeholder={t("lastNamePlaceholder")} />

          <FormLabel text={t("placeOfBirth")} />
          <FormInput value={values.birthPlace} onChangeText={(v) => set("birthPlace", v)} placeholder={t("placeOfBirthPlaceholder")} />

          <FormLabel text={t("religion")} />
          <ChipSelector options={RELIGIONS} selected={values.religion} onSelect={(v) => set("religion", v as Religion)} />

          <FormLabel text={t("ethnicity")} />
          <ChipSelector options={ETHNICITIES} selected={values.race} onSelect={(v) => set("race", v === values.race ? "" : v)} />

          <FormLabel text={t("notes")} />
          <FormInput value={values.bio} onChangeText={(v) => set("bio", v)} placeholder={t("notesPlaceholder")} multiline />
        </>
      )}

      {/* Big, easy-to-reach save button at the end of the form */}
      <Pressable onPress={onSave} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <View className="bg-primary rounded-2xl py-4 items-center mt-2">
          <Text className="text-white text-base font-semibold">{t("saveMember")}</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}
