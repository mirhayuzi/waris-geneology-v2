import { useState, useMemo, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { useFamily } from "@/lib/family-store";
import { getDisplayName, Person } from "@/lib/types";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

// 92% of screen: small gap at top lets user tap-to-dismiss; large enough for
// the search bar to stay visible above the keyboard on all screen sizes.
const SHEET_HEIGHT = Dimensions.get("window").height * 0.92;

interface Props {
  value: string | null;
  onChange: (memberId: string) => void;
  placeholder?: string;
  excludeIds?: string[];
  label?: string;
  /** Only show members of this gender */
  filterGender?: "male" | "female";
  /**
   * Controlled-mode: when provided, skips rendering the trigger button
   * and uses this value to control modal visibility.
   */
  isOpen?: boolean;
  onRequestClose?: () => void;
  /**
   * Override the person list (skips useFamily). Useful when the caller
   * already has a pre-filtered list (e.g. RelationshipLinkSelector).
   */
  personList?: Person[];
}

export function PersonSearchSelector({
  value,
  onChange,
  placeholder = "Pilih ahli keluarga",
  excludeIds = [],
  label,
  filterGender,
  isOpen,
  onRequestClose,
  personList,
}: Props) {
  const { data } = useFamily();
  const colors = useColors();
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState("");

  const controlled = isOpen !== undefined;
  const modalVisible = controlled ? isOpen : internalOpen;

  const source = personList ?? data.persons;

  const selected = value ? source.find((p) => p.id === value) ?? data.persons.find((p) => p.id === value) : null;

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return source
      .filter((p) => !excludeIds.includes(p.id))
      .filter((p) => !filterGender || p.gender === filterGender)
      .filter(
        (p) =>
          q === "" ||
          getDisplayName(p).toLowerCase().includes(q) ||
          p.firstName.toLowerCase().includes(q) ||
          (p.binBinti ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
  }, [source, excludeIds, filterGender, query]);

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id);
      if (controlled) {
        onRequestClose?.();
      } else {
        setInternalOpen(false);
      }
      setQuery("");
    },
    [onChange, controlled, onRequestClose]
  );

  const handleClose = useCallback(() => {
    if (controlled) {
      onRequestClose?.();
    } else {
      setInternalOpen(false);
    }
    setQuery("");
  }, [controlled, onRequestClose]);

  const sheet = (
    <Modal
      visible={modalVisible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/*
        Flex-column layout: backdrop (flex:1) sits above the sheet and
        handles tap-to-dismiss. KAV gets a fixed height (SHEET_HEIGHT) so
        React Native can compute how much to shrink when the keyboard appears.

        iOS  — behavior="padding": KAV adds paddingBottom equal to keyboard
               height, so the FlatList (flex:1) yields space upward.
        Android — behavior="height": KAV reduces its own height, FlatList
               (flex:1) shrinks with it. If content is still clipped after
               a device-specific status-bar quirk, set keyboardVerticalOffset
               to StatusBar.currentHeight.
      */}
      <View style={{ flex: 1 }}>
        {/* Tap-to-dismiss area above the sheet */}
        <Pressable
          onPress={handleClose}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
        />

        {/* Sheet — near-fullscreen so the search bar is never hidden */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ height: SHEET_HEIGHT }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -3 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
              elevation: 12,
            }}
          >
            {/* Drag handle */}
            <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 6 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>

            {/* Header — fixed height, always visible above keyboard */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingBottom: 12,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>
                {label ?? "Pilih Ahli Keluarga"}
              </Text>
              <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <View
                  style={{
                    width: 30, height: 30, borderRadius: 15,
                    backgroundColor: colors.surface,
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  <IconSymbol name="xmark" size={13} color={colors.muted} />
                </View>
              </Pressable>
            </View>

            {/* Search input — fixed, always visible above keyboard */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  gap: 8,
                }}
              >
                <IconSymbol name="magnifyingglass" size={15} color={colors.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Cari nama..."
                  placeholderTextColor={colors.muted}
                  autoFocus
                  returnKeyType="search"
                  style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: colors.foreground }}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery("")}>
                    <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
                  </Pressable>
                )}
              </View>
            </View>

            {/*
              Results list — flex:1 so it fills all remaining vertical space.
              When the keyboard appears, KAV shrinks this area (not the header/
              search above), so results stay scrollable above the keyboard.
              keyboardShouldPersistTaps="handled" lets the user tap a result
              without having to dismiss the keyboard first.
            */}
            <FlatList
              data={filtered}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ fontSize: 14, color: colors.muted }}>Tiada hasil dijumpai</Text>
                </View>
              }
              renderItem={({ item }) => {
                const birthYear = item.birthDate?.slice(0, 4);
                const genderLabel = item.gender === "male" ? "Lelaki" : "Perempuan";
                const subtitle = birthYear ? `${genderLabel} · ${birthYear}` : genderLabel;
                const isSelected = value === item.id;

                return (
                  <Pressable
                    onPress={() => handleSelect(item.id)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 11,
                        borderBottomWidth: 1,
                        borderColor: colors.border + "50",
                      }}
                    >
                      <View
                        style={{
                          width: 36, height: 36, borderRadius: 18,
                          alignItems: "center", justifyContent: "center",
                          marginRight: 12,
                          backgroundColor: isSelected ? colors.primary + "20" : colors.surface,
                        }}
                      >
                        <Text style={{ fontSize: 17 }}>{item.gender === "male" ? "♂" : "♀"}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: isSelected ? colors.primary : colors.foreground,
                          }}
                        >
                          {getDisplayName(item)}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>{subtitle}</Text>
                      </View>
                      {isSelected && (
                        <IconSymbol name="checkmark.circle.fill" size={18} color={colors.primary} />
                      )}
                    </View>
                  </Pressable>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  // Controlled mode: just render the modal, no trigger button
  if (controlled) return sheet;

  return (
    <View>
      {label && (
        <Text
          style={{
            fontSize: 11, fontWeight: "600", color: colors.muted,
            textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8,
          }}
        >
          {label}
        </Text>
      )}

      <Pressable
        onPress={() => setInternalOpen(true)}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            backgroundColor: selected ? colors.primary + "12" : colors.surface,
            borderColor: selected ? colors.primary + "60" : colors.border,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: selected ? "600" : "400",
              color: selected ? colors.primary : colors.muted,
            }}
          >
            {selected ? getDisplayName(selected) : placeholder}
          </Text>
          <IconSymbol name="chevron.down" size={15} color={selected ? colors.primary : colors.muted} />
        </View>
      </Pressable>

      {sheet}
    </View>
  );
}
