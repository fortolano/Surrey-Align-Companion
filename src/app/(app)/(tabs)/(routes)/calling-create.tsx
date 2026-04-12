import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { webShadow, webShadowRgba } from '@/lib/web-styles';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Switch,
  RefreshControl,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import { appAlert } from '@/lib/platform-alert';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import { navigateToReturnTarget } from '@/lib/navigation-return-target';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';

interface LocalUnit { id: number; name: string; code?: string | null; unit_type?: 'ward' | 'branch' | string; }
interface CallingOption { id: number; name: string; level?: string; category?: string; organization_type?: string; }
interface AssignmentOption {
  id: number;
  name: string;
  kind: 'organization' | 'council' | string;
  level?: string | null;
  ward_id?: number | null;
  type?: string | null;
}
interface Holder {
  membership_record_id?: number | null;
  user_id?: number | null;
  user_name: string;
  name?: string;
  label: string;
  ward_id?: number | null;
  current_calling_text?: string | null;
}
interface DirectoryPerson {
  membership_record_id: number;
  user_id?: number | null;
  name: string;
  label: string;
  ward_id?: number | null;
  ward_label?: string | null;
  current_calling_id?: number | null;
  current_calling_text?: string | null;
}
interface SubmissionContext {
  allowed_scopes: ('stake' | 'ward')[];
  allowed_levels?: ('stake' | 'local_unit')[];
  allowed_local_units?: LocalUnit[] | null;
  allowed_wards: LocalUnit[] | null;
  can_create: boolean;
}

interface NomineeEntry {
  name: string;
  user_id: string;
  membership_record_id: string;
  ward_id: string;
  current_calling_id: string;
  current_calling_text: string;
  requires_release: boolean;
  recommendation: string;
}

interface SearchOption {
  value: string;
  label: string;
  subtitle?: string;
}

interface AssignmentResponse {
  organizations?: AssignmentOption[];
  councils?: AssignmentOption[];
  assignment_options?: AssignmentOption[];
  uses_local_unit_context?: boolean;
  data?: AssignmentOption[];
}

function formatUnitLabel(unitType?: string | null, code?: string | null): string | undefined {
  const unitLabel = unitType ? unitType.charAt(0).toUpperCase() + unitType.slice(1) : null;
  if (unitLabel && code) return `${unitLabel} · ${code}`;
  if (unitLabel) return unitLabel;
  if (code) return code;

  return undefined;
}

function emptyNominee(): NomineeEntry {
  return {
    name: '',
    user_id: '',
    membership_record_id: '',
    ward_id: '',
    current_calling_id: '',
    current_calling_text: '',
    requires_release: true,
    recommendation: '',
  };
}

function isStakeReviewedLocalCalling(calling?: CallingOption | null): boolean {
  if (!calling || calling.level === 'stake') return false;

  if (calling.category === 'elders_quorum') {
    return /president|counselor/i.test(calling.name);
  }

  return [
    'Bishopric First Counselor',
    'Bishopric Second Counselor',
    'Branch Presidency First Counselor',
    'Branch Presidency Second Counselor',
    'Ward Clerk',
  ].includes(calling.name);
}

function callingMatchesCurrentContext(
  calling: CallingOption,
  scope: string,
  localUnitType: string,
): boolean {
  if (scope === 'stake') {
    if (calling.level === 'stake') return true;
    if (!isStakeReviewedLocalCalling(calling)) return false;
    if (!localUnitType) return true;
    if (localUnitType === 'branch') {
      return calling.level === 'branch' || calling.level === 'ward';
    }
    return calling.level === 'ward';
  }

  if (!localUnitType) return false;
  if (calling.name === 'Bishop' || calling.name === 'Branch President') return false;

  if (localUnitType === 'branch') {
    return calling.level === 'branch' || calling.level === 'ward';
  }

  return calling.level === 'ward';
}

function formatAssignmentSubtitle(option: AssignmentOption): string | undefined {
  if (option.kind === 'council') {
    return option.type === 'committee' ? 'Stake committee' : 'Stake council';
  }

  const levelLabel = option.level ? option.level.charAt(0).toUpperCase() + option.level.slice(1) : null;
  const typeLabel = option.type ? option.type.replace(/_/g, ' ') : null;

  if (levelLabel && typeLabel) return `${levelLabel} · ${typeLabel}`;
  if (levelLabel) return levelLabel;
  if (typeLabel) return typeLabel;

  return undefined;
}

function formatDirectoryPersonSubtitle(person: DirectoryPerson): string | undefined {
  const parts = [person.ward_label, person.current_calling_text].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function SearchSheetField({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  searchPlaceholder,
  emptyText,
}: {
  label: string;
  value: string;
  options: SearchOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedOption = options.find((option) => option.value === value) || null;
  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return options;

    return options.filter((option) => {
      const labelMatch = option.label.toLowerCase().includes(trimmed);
      const subtitleMatch = option.subtitle?.toLowerCase().includes(trimmed);
      return labelMatch || subtitleMatch;
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  return (
    <View style={pfStyles.container}>
      <Text style={pfStyles.label}>{label}</Text>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[pfStyles.trigger, disabled && pfStyles.disabled]}
      >
        <Text
          style={[pfStyles.triggerText, !selectedOption && pfStyles.placeholder]}
          numberOfLines={1}
        >
          {selectedOption?.label || placeholder || 'Select...'}
        </Text>
        <Ionicons name="search-outline" size={16} color={disabled ? Colors.brand.lightGray : Colors.brand.primary} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={sheetStyles.backdrop}>
          <Pressable style={sheetStyles.dismissArea} onPress={() => setOpen(false)} />
          <View style={sheetStyles.card}>
            <View style={sheetStyles.handle} />
            <View style={sheetStyles.header}>
              <Text style={sheetStyles.title}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={Colors.brand.midGray} />
              </Pressable>
            </View>
            <TextInput
              style={sheetStyles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder || `Search ${label.toLowerCase()}`}
              placeholderTextColor={Colors.brand.midGray}
              autoCapitalize="words"
            />
            <ScrollView style={sheetStyles.results} keyboardShouldPersistTaps="handled">
              {filteredOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={[sheetStyles.resultItem, value === option.value && sheetStyles.resultItemActive]}
                >
                  <View style={sheetStyles.resultInfo}>
                    <Text style={[sheetStyles.resultTitle, value === option.value && sheetStyles.resultTitleActive]}>
                      {option.label}
                    </Text>
                    {option.subtitle ? <Text style={sheetStyles.resultSubtitle}>{option.subtitle}</Text> : null}
                  </View>
                  <Ionicons
                    name={value === option.value ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={value === option.value ? Colors.brand.primary : Colors.brand.lightGray}
                  />
                </Pressable>
              ))}
              {filteredOptions.length === 0 && (
                <Text style={sheetStyles.emptyText}>{emptyText || 'No matches found.'}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SearchAssistButton({
  label,
  options,
  onSelect,
  buttonText,
  searchPlaceholder,
  emptyText,
}: {
  label: string;
  options: SearchOption[];
  onSelect: (option: SearchOption) => void;
  buttonText: string;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return options;

    return options.filter((option) => {
      const labelMatch = option.label.toLowerCase().includes(trimmed);
      const subtitleMatch = option.subtitle?.toLowerCase().includes(trimmed);
      return labelMatch || subtitleMatch;
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  return (
    <View style={styles.assistWrap}>
      <Pressable onPress={() => setOpen(true)} style={styles.assistButton}>
        <Ionicons name="list-outline" size={16} color={Colors.brand.primary} />
        <Text style={styles.assistButtonText}>{buttonText}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={sheetStyles.backdrop}>
          <Pressable style={sheetStyles.dismissArea} onPress={() => setOpen(false)} />
          <View style={sheetStyles.card}>
            <View style={sheetStyles.handle} />
            <View style={sheetStyles.header}>
              <Text style={sheetStyles.title}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={Colors.brand.midGray} />
              </Pressable>
            </View>
            <TextInput
              style={sheetStyles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder || `Search ${label.toLowerCase()}`}
              placeholderTextColor={Colors.brand.midGray}
              autoCapitalize="words"
            />
            <ScrollView style={sheetStyles.results} keyboardShouldPersistTaps="handled">
              {filteredOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                  style={sheetStyles.resultItem}
                >
                  <View style={sheetStyles.resultInfo}>
                    <Text style={sheetStyles.resultTitle}>{option.label}</Text>
                    {option.subtitle ? <Text style={sheetStyles.resultSubtitle}>{option.subtitle}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
                </Pressable>
              ))}
              {filteredOptions.length === 0 && (
                <Text style={sheetStyles.emptyText}>{emptyText || 'No matches found.'}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DirectoryLookupAssistButton({
  token,
  label,
  buttonText,
  onSelect,
  wardId,
  disabled,
  searchPlaceholder,
  emptyText,
}: {
  token: string | null;
  label: string;
  buttonText: string;
  onSelect: (person: DirectoryPerson) => void;
  wardId?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
      return;
    }

    const timeoutId = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 280);

    return () => clearTimeout(timeoutId);
  }, [open, query]);

  const { data, isFetching } = useQuery<{ people?: DirectoryPerson[] }>({
    queryKey: ['/api/reference/people/search', debouncedQuery, wardId || 'all'],
    queryFn: ({ signal }) => authFetch(token, '/api/reference/people/search', {
      params: {
        q: debouncedQuery,
        ward_id: wardId || undefined,
      },
      signal,
    }),
    enabled: !!token && open && debouncedQuery.length >= 2,
    staleTime: 30000,
  });

  const people = data?.people || [];

  return (
    <View style={styles.assistWrap}>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[styles.assistButton, disabled && styles.disabledBtn]}
      >
        <Ionicons name="search-outline" size={16} color={Colors.brand.primary} />
        <Text style={styles.assistButtonText}>{buttonText}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={sheetStyles.backdrop}>
          <Pressable style={sheetStyles.dismissArea} onPress={() => setOpen(false)} />
          <View style={sheetStyles.card}>
            <View style={sheetStyles.handle} />
            <View style={sheetStyles.header}>
              <Text style={sheetStyles.title}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={Colors.brand.midGray} />
              </Pressable>
            </View>
            <TextInput
              style={sheetStyles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder || `Search ${label.toLowerCase()}`}
              placeholderTextColor={Colors.brand.midGray}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <ScrollView style={sheetStyles.results} keyboardShouldPersistTaps="handled">
              {debouncedQuery.length < 2 ? (
                <Text style={sheetStyles.emptyText}>Type at least 2 letters to search the membership directory.</Text>
              ) : null}
              {debouncedQuery.length >= 2 && isFetching ? (
                <View style={styles.directoryLoading}>
                  <ActivityIndicator size="small" color={Colors.brand.primary} />
                </View>
              ) : null}
              {debouncedQuery.length >= 2 && !isFetching && people.map((person) => (
                <Pressable
                  key={String(person.membership_record_id)}
                  onPress={() => {
                    onSelect(person);
                    setOpen(false);
                  }}
                  style={sheetStyles.resultItem}
                >
                  <View style={sheetStyles.resultInfo}>
                    <Text style={sheetStyles.resultTitle}>{person.name}</Text>
                    {formatDirectoryPersonSubtitle(person) ? (
                      <Text style={sheetStyles.resultSubtitle}>{formatDirectoryPersonSubtitle(person)}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
                </Pressable>
              ))}
              {debouncedQuery.length >= 2 && !isFetching && people.length === 0 ? (
                <Text style={sheetStyles.emptyText}>{emptyText || 'No matching people were found.'}</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PickerField({ label, value, options, onChange, placeholder, disabled }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(o => o.value === value)?.label || '';

  return (
    <View style={pfStyles.container}>
      <Text style={pfStyles.label}>{label}</Text>
      <Pressable
        onPress={() => !disabled && setOpen(!open)}
        style={[pfStyles.trigger, disabled && pfStyles.disabled]}
      >
        <Text style={[pfStyles.triggerText, !selectedLabel && pfStyles.placeholder]} numberOfLines={1}>
          {selectedLabel || placeholder || 'Select...'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={disabled ? Colors.brand.lightGray : Colors.brand.darkGray} />
      </Pressable>
      {open && (
        <View style={pfStyles.dropdown}>
          <ScrollView style={pfStyles.dropdownScroll} nestedScrollEnabled>
            {options.map(opt => (
              <Pressable
                key={opt.value}
                onPress={() => { onChange(opt.value); setOpen(false); }}
                style={[pfStyles.option, value === opt.value && pfStyles.optionActive]}
              >
                <Text style={[pfStyles.optionText, value === opt.value && pfStyles.optionTextActive]} numberOfLines={2}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const pfStyles = StyleSheet.create({
  container: { marginBottom: 18 },
  label: { fontSize: 15, fontWeight: '600' as const, color: Colors.brand.dark, marginBottom: 6, fontFamily: 'Inter_600SemiBold' },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.brand.inputBg, borderRadius: 12, borderWidth: 1, borderColor: Colors.brand.inputBorder,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  disabled: { opacity: 0.5 },
  triggerText: { fontSize: 15, color: Colors.brand.dark, fontFamily: 'Inter_400Regular', flex: 1, marginRight: 8 },
  placeholder: { color: Colors.brand.midGray },
  dropdown: {
    marginTop: 4, backgroundColor: Colors.brand.white, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.brand.lightGray, overflow: 'hidden',
    ...webShadow('#000', 0, 2, 0.1, 8), elevation: 4,
  },
  dropdownScroll: { maxHeight: 220 },
  option: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.brand.lightGray },
  optionActive: { backgroundColor: Colors.brand.accent },
  optionText: { fontSize: 14, color: Colors.brand.dark, fontFamily: 'Inter_400Regular' },
  optionTextActive: { color: Colors.brand.primary, fontFamily: 'Inter_600SemiBold' },
});

const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  card: {
    backgroundColor: Colors.brand.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '82%',
  },
  handle: {
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.brand.lightGray,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, color: Colors.brand.dark, fontFamily: 'Inter_700Bold' },
  searchInput: {
    backgroundColor: Colors.brand.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  results: { maxHeight: 320 },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
  resultItemActive: { backgroundColor: '#F8FAFC' },
  resultInfo: { flex: 1 },
  resultTitle: { fontSize: 14, color: Colors.brand.dark, fontFamily: 'Inter_600SemiBold' },
  resultTitleActive: { color: Colors.brand.primary },
  resultSubtitle: { fontSize: 13, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular', marginTop: 2 },
  emptyText: { fontSize: 13, color: Colors.brand.midGray, textAlign: 'center', paddingVertical: 18, fontFamily: 'Inter_400Regular' },
});

function IndividualCard({ entry, index, wards, callings, token, onUpdate, onApplyDirectoryPerson, onToggleRelease, onRemove, canRemove }: {
  entry: NomineeEntry;
  index: number;
  wards: SearchOption[];
  callings: CallingOption[];
  token: string | null;
  onUpdate: (field: keyof NomineeEntry, value: string) => void;
  onApplyDirectoryPerson: (person: DirectoryPerson) => void;
  onToggleRelease: (value: boolean) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <View style={icStyles.card}>
      <View style={icStyles.header}>
        <Text style={icStyles.headerText}>Individual {index + 1}</Text>
        {canRemove && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Ionicons name="close-circle" size={22} color={Colors.brand.midGray} />
          </Pressable>
        )}
      </View>
      <View style={icStyles.field}>
        <Text style={icStyles.label}>Name *</Text>
        <TextInput
          style={icStyles.input}
          value={entry.name}
          onChangeText={v => onUpdate('name', v)}
          placeholder="Full name"
          placeholderTextColor={Colors.brand.midGray}
        />
        <DirectoryLookupAssistButton
          token={token}
          label={`Individual ${index + 1}`}
          buttonText="Search membership directory"
          onSelect={onApplyDirectoryPerson}
          searchPlaceholder="Search members by name"
          emptyText="No matching person was found."
        />
        {entry.membership_record_id ? (
          <Text style={styles.selectionSummary}>Directory match selected for this individual.</Text>
        ) : null}
      </View>
      <SearchSheetField
        label="Local Unit"
        value={entry.ward_id}
        options={wards}
        onChange={v => onUpdate('ward_id', v)}
        placeholder="Select Local Unit"
        searchPlaceholder="Search local units"
        emptyText="No local units matched that search."
      />
      <View style={icStyles.field}>
        <Text style={icStyles.label}>Current Calling</Text>
        <TextInput
          style={icStyles.input}
          value={entry.current_calling_text}
          onChangeText={v => onUpdate('current_calling_text', v)}
          placeholder="Type a calling title or leave blank"
          placeholderTextColor={Colors.brand.midGray}
          autoCapitalize="words"
          onBlur={() => {
            const match = callings.find((calling) => calling.name.toLowerCase() === entry.current_calling_text.trim().toLowerCase());
            if (match) {
              onUpdate('current_calling_text', match.name);
            }
          }}
        />
        <Text style={styles.hintText}>Exact matches stay linked to the catalog. Other titles are saved as typed.</Text>
        {callings.length > 0 && (
          <SearchAssistButton
            label="Current Calling"
            options={callings.map((calling) => ({
              value: String(calling.id),
              label: calling.name,
            }))}
            onSelect={(option) => {
              onUpdate('current_calling_text', option.label);
              onUpdate('current_calling_id', option.value);
            }}
            buttonText="Browse full calling list"
            searchPlaceholder="Search current callings"
            emptyText="No current callings matched that search."
          />
        )}
      </View>
      {!!entry.current_calling_text.trim() && (
        <View style={icStyles.releaseRow}>
          <View style={icStyles.releaseInfo}>
            <Text style={icStyles.releaseLabel}>Needs release from current calling</Text>
            <Text style={icStyles.releaseHint}>This person will be released from their current calling as part of this process</Text>
          </View>
          <Switch
            value={entry.requires_release}
            onValueChange={onToggleRelease}
            trackColor={{ false: Colors.brand.lightGray, true: Colors.brand.primary + '80' }}
            thumbColor={entry.requires_release ? Colors.brand.primary : '#f4f3f4'}
            style={{ transform: [{ scaleX: 1.08 }, { scaleY: 1.08 }] }}
          />
        </View>
      )}
      <View style={icStyles.field}>
        <Text style={icStyles.label}>Recommendation</Text>
        <TextInput
          style={[icStyles.input, icStyles.multiline]}
          value={entry.recommendation}
          onChangeText={v => onUpdate('recommendation', v)}
          placeholder="Why this individual?"
          placeholderTextColor={Colors.brand.midGray}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
    </View>
  );
}

const icStyles = StyleSheet.create({
  card: { backgroundColor: Colors.brand.sectionBg, borderRadius: 14, padding: 16, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerText: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.primary, fontFamily: 'Inter_600SemiBold' },
  field: { marginBottom: 18 },
  label: { fontSize: 15, fontWeight: '600' as const, color: Colors.brand.dark, marginBottom: 6, fontFamily: 'Inter_600SemiBold' },
  input: {
    backgroundColor: Colors.brand.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.brand.inputBorder,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: Colors.brand.dark, fontFamily: 'Inter_400Regular',
  },
  multiline: { minHeight: 70, paddingTop: 12 },
  releaseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12 },
  releaseInfo: { flex: 1 },
  releaseLabel: { fontSize: 14, fontWeight: '600' as const, color: '#92400e', fontFamily: 'Inter_600SemiBold' },
  releaseHint: { fontSize: 14, color: '#92400e', fontFamily: 'Inter_400Regular', marginTop: 2, opacity: 0.8 },
});

export default function CallingCreateScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const qClient = useQueryClient();
  const navigation = useNavigation();
  const pathname = usePathname();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const webBottomInset = WEB_BOTTOM_INSET;
  const allowLeaveWithoutPromptRef = useRef(false);

  const [scope, setScope] = useState<string>('');
  const [localUnitType, setLocalUnitType] = useState<string>('');
  const [wardId, setWardId] = useState<string>('');
  const [callingId, setCallingId] = useState<string>('');
  const [callingText, setCallingText] = useState<string>('');
  const [assignmentValue, setAssignmentValue] = useState<string>('');
  const [currentHolderUserId, setCurrentHolderUserId] = useState<string>('');
  const [currentHolderMembershipRecordId, setCurrentHolderMembershipRecordId] = useState<string>('');
  const [currentHolderName, setCurrentHolderName] = useState<string>('');
  const [holderManuallyEdited, setHolderManuallyEdited] = useState(false);
  const [contextNotes, setContextNotes] = useState('');
  const [nominees, setNominees] = useState<NomineeEntry[]>([emptyNominee()]);
  const [submitting, setSubmitting] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const navigateBackToOrigin = useCallback(() => {
    navigateToReturnTarget(router, pathname, returnTo);
  }, [pathname, returnTo]);

  // Warn if navigating away with unsaved changes
  useEffect(() => {
    const hasChanges = !!(callingText.trim() || contextNotes.trim() || nominees.some(n => n.name.trim()));
    if (!hasChanges) return;
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (allowLeaveWithoutPromptRef.current) return;
      e.preventDefault();
      appAlert('Discard Changes?', 'You have unsaved changes that will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, callingText, contextNotes, nominees]);


  const { data: ctx, isLoading: ctxLoading, refetch: refetchSubmissionContext } = useQuery<SubmissionContext>({
    queryKey: ['/api/calling-requests/submission-context'],
    queryFn: () => authFetch(token, '/api/calling-requests/submission-context'),
    enabled: !!token,
  });

  const { data: allWards, refetch: refetchWards } = useQuery<{ wards?: LocalUnit[]; data?: LocalUnit[] }>({
    queryKey: ['/api/reference/wards'],
    queryFn: () => authFetch(token, '/api/reference/wards'),
    enabled: !!token,
  });

  const { data: allCallingsData, refetch: refetchAllCallings } = useQuery<{ callings?: CallingOption[]; data?: CallingOption[] }>({
    queryKey: ['/api/reference/callings', 'all'],
    queryFn: () => authFetch(token, '/api/reference/callings'),
    enabled: !!token,
  });

  const { data: callingsData, refetch: refetchCallings } = useQuery<{ callings?: CallingOption[]; data?: CallingOption[] }>({
    queryKey: ['/api/reference/callings', scope, localUnitType],
    queryFn: () => authFetch(token, '/api/reference/callings', {
      params: scope === 'stake'
        ? { scope: 'stake', unit_type: localUnitType || undefined, importable_only: 1 }
        : { scope: 'ward', unit_type: localUnitType, importable_only: 1 },
    }),
    enabled: !!token && !!scope && (scope === 'stake' || !!localUnitType),
  });

  const allCallings = useMemo(() => allCallingsData?.callings || allCallingsData?.data || [], [allCallingsData]);
  const callings = useMemo(() => callingsData?.callings || callingsData?.data || [], [callingsData]);
  const selectedCalling = useMemo(() => {
    if (!callingId) {
      return null;
    }

    return callings.find((calling) => String(calling.id) === callingId)
      || allCallings.find((calling) => String(calling.id) === callingId)
      || null;
  }, [allCallings, callingId, callings]);

  const { data: assignmentsData, refetch: refetchOrganizations } = useQuery<AssignmentResponse>({
    queryKey: ['/api/reference/organizations', 'calling_request', scope, localUnitType, wardId, callingId],
    queryFn: () => authFetch(token, '/api/reference/organizations', {
      params: {
        mode: 'calling_request',
        scope,
        unit_type: localUnitType || undefined,
        ward_id: wardId || undefined,
        target_calling_id: callingId || undefined,
      },
    }),
    enabled: !!token && !!scope && (scope === 'stake' || !!localUnitType),
  });

  const selectedCallingNeedsLocalUnitContext = scope === 'stake' && isStakeReviewedLocalCalling(selectedCalling);
  const serverUsesLocalUnitContext = assignmentsData?.uses_local_unit_context === true;
  const requestUsesLocalUnitContext = scope === 'ward' || selectedCallingNeedsLocalUnitContext || serverUsesLocalUnitContext;
  const showLocalUnitControls = scope === 'ward' || selectedCallingNeedsLocalUnitContext || serverUsesLocalUnitContext;

  const { data: holdersData, refetch: refetchCurrentHolders } = useQuery<{ holders?: Holder[]; data?: Holder[] }>({
    queryKey: ['/api/reference/current-holders', callingId, wardId],
    queryFn: () => authFetch(token, `/api/reference/current-holders/${callingId}`, {
      params: requestUsesLocalUnitContext && wardId ? { ward_id: wardId } : {},
    }),
    enabled: !!token && !!callingId && (!requestUsesLocalUnitContext || !!wardId),
  });

  const handleRefresh = useCallback(async () => {
    triggerGlobalRefreshIndicator();
    setIsManualRefreshing(true);
    try {
      const tasks: Promise<unknown>[] = [
        refetchSubmissionContext(),
        refetchWards(),
        refetchAllCallings(),
      ];

      if (scope) {
        tasks.push(refetchCallings());
      }
      if (scope && (scope === 'stake' || !!localUnitType)) {
        tasks.push(refetchOrganizations());
      }
      if (callingId) {
        tasks.push(refetchCurrentHolders());
      }

      await Promise.all(tasks);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [
    refetchSubmissionContext,
    refetchWards,
    refetchAllCallings,
    refetchCallings,
    refetchOrganizations,
    refetchCurrentHolders,
    scope,
    localUnitType,
    callingId,
  ]);

  useEffect(() => {
    if (ctx?.allowed_scopes?.length === 1) {
      setScope(ctx.allowed_scopes[0]);
    }
    if (ctx?.allowed_local_units?.length === 1) {
      setWardId(String(ctx.allowed_local_units[0].id));
      setLocalUnitType(String(ctx.allowed_local_units[0].unit_type || 'ward'));
    }
  }, [ctx]);

  useEffect(() => {
    if (scope === 'stake') {
      setLocalUnitType('');
    }
    setWardId('');
    setCallingText('');
    setCallingId('');
    setAssignmentValue('');
    setCurrentHolderUserId('');
    setCurrentHolderMembershipRecordId('');
    setCurrentHolderName('');
    setHolderManuallyEdited(false);
  }, [scope]);

  useEffect(() => {
    const currentCalling = callingId
      ? callings.find((calling) => String(calling.id) === callingId)
        || allCallings.find((calling) => String(calling.id) === callingId)
        || null
      : null;

    setWardId('');
    setAssignmentValue('');
    setCurrentHolderUserId('');
    setCurrentHolderMembershipRecordId('');
    setCurrentHolderName('');
    setHolderManuallyEdited(false);

    if (currentCalling && !callingMatchesCurrentContext(currentCalling, scope, localUnitType)) {
      setCallingText('');
      setCallingId('');
    }
  }, [localUnitType, allCallings, callingId, callings, scope]);

  useEffect(() => {
    setAssignmentValue('');
    setCurrentHolderUserId('');
    setCurrentHolderMembershipRecordId('');
    if (!holderManuallyEdited) {
      setCurrentHolderName('');
    }
  }, [wardId, holderManuallyEdited]);

  useEffect(() => {
    setCurrentHolderUserId('');
    setCurrentHolderMembershipRecordId('');
    if (!holderManuallyEdited) {
      setCurrentHolderName('');
    }

    if (requestUsesLocalUnitContext && !wardId) {
      return;
    }

    const holders = holdersData?.holders || holdersData?.data || [];
    if (!holderManuallyEdited && holders.length === 1) {
      const matched = holders[0];
      setCurrentHolderUserId(matched.user_id ? String(matched.user_id) : '');
      setCurrentHolderMembershipRecordId(matched.membership_record_id ? String(matched.membership_record_id) : '');
      setCurrentHolderName(matched.user_name || matched.name || '');
    }
  }, [holdersData, requestUsesLocalUnitContext, wardId, holderManuallyEdited]);

  useEffect(() => {
    const options = assignmentsData?.assignment_options || assignmentsData?.data || [];
    if (!selectedCalling || options.length === 0) {
      return;
    }

    if (requestUsesLocalUnitContext && !wardId) {
      if (assignmentValue) {
        setAssignmentValue('');
      }
      return;
    }

    let organizationType = selectedCalling.organization_type || '';
    if (selectedCalling.category === 'bishopric' && requestUsesLocalUnitContext) {
      organizationType = localUnitType === 'branch' ? 'presidency' : 'bishopric';
    }

    if (!organizationType) {
      return;
    }

    const current = options.find((option) => `${option.kind}_${option.id}` === assignmentValue) || null;
    if (current) {
      const currentMatchesContext = requestUsesLocalUnitContext
        ? current.kind === 'organization'
          && current.level === localUnitType
          && (!wardId || String(current.ward_id || '') === wardId)
        : current.kind === 'council' || current.level === 'stake';

      if (currentMatchesContext) {
        return;
      }
    }

    const bestMatch = options.find((option) => {
      if (option.kind !== 'organization' || option.type !== organizationType) {
        return false;
      }

      if (requestUsesLocalUnitContext) {
        if (option.level !== localUnitType) return false;
        return !wardId || String(option.ward_id || '') === wardId;
      }

      return option.level === 'stake';
    });

    if (bestMatch) {
      setAssignmentValue(`${bestMatch.kind}_${bestMatch.id}`);
    }
  }, [assignmentValue, assignmentsData, localUnitType, requestUsesLocalUnitContext, selectedCalling, wardId]);

  const allLocalUnits = ctx?.allowed_local_units || allWards?.wards || allWards?.data || [];
  const localUnitsForForm = localUnitType
    ? allLocalUnits.filter((unit) => unit.unit_type === localUnitType)
    : [];
  const assignmentOptions = useMemo(
    () => {
      const options = assignmentsData?.assignment_options || assignmentsData?.data || [];

      if (requestUsesLocalUnitContext && (!localUnitType || !wardId)) {
        return [];
      }

      return options;
    },
    [assignmentsData, localUnitType, requestUsesLocalUnitContext, wardId],
  );

  const wardOptions: SearchOption[] = localUnitsForForm.map((unit) => ({
    value: String(unit.id),
    label: unit.name,
    subtitle: formatUnitLabel(unit.unit_type, unit.code),
  }));
  const assignmentSearchOptions: SearchOption[] = assignmentOptions.map((option) => ({
    value: `${option.kind}_${option.id}`,
    label: option.name,
    subtitle: formatAssignmentSubtitle(option),
  }));
  const individualWardOptions: SearchOption[] = allLocalUnits.map((unit) => ({
    value: String(unit.id),
    label: unit.name,
    subtitle: formatUnitLabel(unit.unit_type, unit.code),
  }));
  const levelOptions = (ctx?.allowed_scopes || []).map(s => ({ value: s, label: s === 'stake' ? 'Stake' : 'Local Unit' }));
  const localUnitTypeOptions = [
    { value: 'ward', label: 'Ward' },
    { value: 'branch', label: 'Branch' },
  ].filter((option) => allLocalUnits.some((unit) => unit.unit_type === option.value));
  const selectedAssignment = assignmentSearchOptions.find((option) => option.value === assignmentValue) || null;

  const linkCallingText = useCallback((text: string) => {
    const trimmed = text.trim();
    const match = callings.find((calling) => calling.name.toLowerCase() === trimmed.toLowerCase());
    if (match) {
      setCallingText(match.name);
      setCallingId(String(match.id));
      return match;
    }
    setCallingText(trimmed);
    setCallingId('');
    return null;
  }, [callings]);

  useEffect(() => {
    if (scope !== 'stake') {
      return;
    }

    if (selectedCallingNeedsLocalUnitContext || !localUnitType) {
      return;
    }

    setLocalUnitType('');
    setWardId('');
    setAssignmentValue('');
    setCurrentHolderUserId('');
    setCurrentHolderMembershipRecordId('');
    if (!holderManuallyEdited) {
      setCurrentHolderName('');
    }
  }, [holderManuallyEdited, localUnitType, scope, selectedCallingNeedsLocalUnitContext]);

  useEffect(() => {
    if (!selectedCallingNeedsLocalUnitContext) {
      return;
    }

    setAssignmentValue('');
    setCurrentHolderUserId('');
    setCurrentHolderMembershipRecordId('');
    if (!holderManuallyEdited) {
      setCurrentHolderName('');
    }
  }, [holderManuallyEdited, selectedCallingNeedsLocalUnitContext]);

  const updateNominee = useCallback((idx: number, field: keyof NomineeEntry, value: string) => {
    setNominees(prev => prev.map((n, i) => {
      if (i !== idx) return n;
      const updated = { ...n, [field]: value };
      if (field === 'name') {
        updated.user_id = '';
        updated.membership_record_id = '';
      }
      if (field === 'current_calling_text') {
        const trimmed = value.trim();
        const match = allCallings.find((calling) => calling.name.toLowerCase() === trimmed.toLowerCase());
        updated.current_calling_id = match ? String(match.id) : '';
        updated.requires_release = !!trimmed;
      }
      return updated;
    }));
  }, [allCallings]);

  const removeNominee = useCallback((idx: number) => {
    setNominees(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const applyNomineeDirectoryPerson = useCallback((idx: number, person: DirectoryPerson) => {
    setNominees(prev => prev.map((nominee, nomineeIndex) => {
      if (nomineeIndex !== idx) {
        return nominee;
      }

      return {
        ...nominee,
        name: person.name,
        user_id: person.user_id ? String(person.user_id) : '',
        membership_record_id: String(person.membership_record_id),
        ward_id: person.ward_id ? String(person.ward_id) : '',
        current_calling_id: person.current_calling_id ? String(person.current_calling_id) : '',
        current_calling_text: person.current_calling_text || '',
        requires_release: !!person.current_calling_text,
      };
    }));
  }, []);

  const addNominee = useCallback(() => {
    if (nominees.length < 3) setNominees(prev => [...prev, emptyNominee()]);
  }, [nominees.length]);

  const handleSubmit = async (asDraft: boolean) => {
    const validNominees = nominees.filter(n => n.name.trim());
    if (validNominees.length === 0) {
      appAlert('Required', 'Please add at least one individual.');
      return;
    }
    if (requestUsesLocalUnitContext && !localUnitType) {
      appAlert('Required', 'Choose whether this request belongs to a ward or a branch.');
      return;
    }
    if (requestUsesLocalUnitContext && !wardId) {
      appAlert('Required', 'Choose the local unit this request belongs to.');
      return;
    }
    if (!callingText.trim()) {
      appAlert('Required', 'Please enter the calling title.');
      return;
    }
    if (!callingId && !assignmentValue) {
      appAlert('Required', 'Choose the organization or council before using a custom calling title.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        request_type: 'calling',
        scope,
        local_unit_type: requestUsesLocalUnitContext ? localUnitType : undefined,
        target_calling_id: callingId ? Number(callingId) : null,
        target_calling_text: callingText.trim(),
        nominees: validNominees.map(n => ({
          name: n.name.trim(),
          user_id: n.user_id ? Number(n.user_id) : null,
          membership_record_id: n.membership_record_id ? Number(n.membership_record_id) : null,
          ward_id: n.ward_id ? Number(n.ward_id) : null,
          current_calling_id: n.current_calling_id ? Number(n.current_calling_id) : null,
          current_calling_text: n.current_calling_text.trim() || null,
          requires_release: n.current_calling_text.trim() ? n.requires_release : undefined,
          recommendation: n.recommendation.trim() || null,
        })),
      };
      if (assignmentValue.startsWith('org_')) {
        payload.target_organization_id = Number(assignmentValue.replace('org_', ''));
      }
      if (assignmentValue.startsWith('council_')) {
        payload.target_council_id = Number(assignmentValue.replace('council_', ''));
      }
      if (requestUsesLocalUnitContext && wardId) {
        payload.target_ward_id = Number(wardId);
        payload.ward_id = Number(wardId);
      }
      if (currentHolderUserId) payload.current_holder_user_id = Number(currentHolderUserId);
      if (currentHolderMembershipRecordId) payload.current_holder_membership_record_id = Number(currentHolderMembershipRecordId);
      if (currentHolderName.trim()) payload.current_holder_name = currentHolderName.trim();
      if (contextNotes.trim()) payload.context_notes = contextNotes.trim();

      const result = await authFetch(token, '/api/calling-requests', { method: 'POST', body: payload });
      const newId = result.calling_request?.id || result.data?.id || result.id;

      if (!asDraft && newId) {
        try {
          await authFetch(token, `/api/calling-requests/${newId}/submit`, { method: 'POST' });
        } catch {}
      }

      qClient.invalidateQueries({ queryKey: ['/api/calling-requests'] });
      qClient.invalidateQueries({ queryKey: ['/api/calling-requests/pending-action-count'] });

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      allowLeaveWithoutPromptRef.current = true;
      navigateBackToOrigin();
    } catch (err: any) {
      appAlert('Error', err.message || 'Failed to create request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (ctxLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
      </View>
    );
  }

  if (ctx && !ctx.can_create) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="lock-closed-outline" size={40} color={Colors.brand.midGray} />
        <Text style={styles.noAccessText}>You do not have permission to create calling requests.</Text>
        <Pressable onPress={navigateBackToOrigin} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.brand.primary}
            colors={[Colors.brand.primary]}
          />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Request Details</Text>
          <View style={styles.fieldsInner}>
            <PickerField
              label="Request Type"
              value="calling"
              options={[{ value: 'calling', label: 'Calling' }]}
              onChange={() => {}}
              disabled
            />
            {ctx && ctx.allowed_scopes.length > 1 ? (
              <PickerField
                label="Level"
                value={scope}
                options={levelOptions}
                onChange={v => { setScope(v); }}
                placeholder="Select Level"
              />
            ) : (
              <View style={pfStyles.container}>
                <Text style={pfStyles.label}>Level</Text>
                <View style={[pfStyles.trigger, pfStyles.disabled]}>
                  <Text style={pfStyles.triggerText}>{scope === 'stake' ? 'Stake' : 'Local Unit'}</Text>
                </View>
              </View>
            )}
            {showLocalUnitControls && (
              <>
                <PickerField
                  label="Local Unit Type"
                  value={localUnitType}
                  options={localUnitTypeOptions}
                  onChange={setLocalUnitType}
                  placeholder="Select Type"
                />
                <SearchSheetField
                  label="Local Unit"
                  value={wardId}
                  options={wardOptions}
                  onChange={setWardId}
                  placeholder={localUnitType ? 'Select Local Unit' : 'Select type first'}
                  disabled={!localUnitType}
                  searchPlaceholder="Search local units"
                  emptyText="No local units matched that search."
                />
              </>
            )}
            {scope === 'stake' && !showLocalUnitControls ? (
              <Text style={styles.helperCallout}>
                Stake-wide requests can use stake organizations and stake councils. Ward or branch fields appear automatically when the selected calling needs local-unit context.
              </Text>
            ) : null}
            {selectedCallingNeedsLocalUnitContext ? (
              <Text style={styles.helperCallout}>
                This calling still belongs to a ward or branch even though the approval starts at the stake level. Choose the local unit so the right organization and holder options appear.
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proposed Calling</Text>
          <View style={styles.fieldsInner}>
            <View style={icStyles.field}>
              <Text style={icStyles.label}>Proposed Calling</Text>
              <TextInput
                style={icStyles.input}
                value={callingText}
                onChangeText={(value) => {
                  setCallingText(value);
                  setCallingId('');
                  setAssignmentValue('');
                }}
                placeholder={scope === 'stake' || localUnitType ? 'Type a calling title' : 'Choose ward or branch first'}
                placeholderTextColor={Colors.brand.midGray}
                autoCapitalize="words"
                onBlur={() => {
                  linkCallingText(callingText);
                }}
              />
              <Text style={styles.hintText}>Exact matches stay linked to the catalog. Other titles are saved as typed.</Text>
              {selectedCalling ? (
                <Text style={styles.selectionSummary}>Catalog calling selected: {selectedCalling.name}</Text>
              ) : null}
              {callings.length > 0 && (
                <SearchAssistButton
                  label="Proposed Calling"
                  options={callings.map((calling) => ({
                    value: String(calling.id),
                    label: calling.name,
                    subtitle: calling.organization_type ? calling.organization_type.replace(/_/g, ' ') : undefined,
                  }))}
                  onSelect={(option) => {
                    setCallingText(option.label);
                    setCallingId(option.value);
                  }}
                  buttonText="Browse full calling list"
                  searchPlaceholder="Search proposed callings"
                  emptyText="No callings matched that search."
                />
              )}
            </View>
            <SearchSheetField
              label="Organization or Council"
              value={assignmentValue}
              options={assignmentSearchOptions}
              onChange={setAssignmentValue}
              placeholder={
                requestUsesLocalUnitContext
                  ? (wardId ? 'Select Organization' : (localUnitType ? 'Select Local Unit first' : 'Select ward or branch first'))
                  : 'Select Organization or Council'
              }
              disabled={assignmentOptions.length === 0 || (requestUsesLocalUnitContext && !wardId)}
              searchPlaceholder="Search organizations and councils"
              emptyText="No matching organizations or councils were found."
            />
            {selectedAssignment ? (
              <Text style={styles.selectionSummary}>{selectedAssignment.label}</Text>
            ) : null}
            <Text style={styles.hintText}>
              {requestUsesLocalUnitContext
                ? 'Only organizations from the selected ward or branch are available here.'
                : 'Stake-wide requests can use either a stake organization or a stake council or committee.'}
            </Text>
            <View style={icStyles.field}>
              <Text style={icStyles.label}>Current Holder</Text>
              <TextInput
                style={icStyles.input}
                value={currentHolderName}
                onChangeText={(value) => {
                  setHolderManuallyEdited(true);
                  setCurrentHolderUserId('');
                  setCurrentHolderMembershipRecordId('');
                  setCurrentHolderName(value);
                }}
                placeholder={callingText ? 'Type a name or leave blank if vacant' : 'Choose the calling first'}
                placeholderTextColor={Colors.brand.midGray}
                autoCapitalize="words"
                onBlur={() => {
                  if (!currentHolderName.trim()) {
                    setHolderManuallyEdited(false);
                    setCurrentHolderMembershipRecordId('');
                  }
                }}
              />
              <DirectoryLookupAssistButton
                token={token}
                label="Current Holder"
                buttonText="Search membership directory"
                wardId={requestUsesLocalUnitContext && wardId ? wardId : undefined}
                disabled={!callingText.trim() || (requestUsesLocalUnitContext && !wardId)}
                onSelect={(person) => {
                  setCurrentHolderName(person.name);
                  setCurrentHolderUserId(person.user_id ? String(person.user_id) : '');
                  setCurrentHolderMembershipRecordId(String(person.membership_record_id));
                  setHolderManuallyEdited(false);
                }}
                searchPlaceholder="Search current holders by name"
                emptyText="No matching current holder was found."
              />
              {currentHolderMembershipRecordId ? (
                <Text style={styles.selectionSummary}>Directory match selected for the current holder.</Text>
              ) : null}
              <Text style={styles.hintText}>
                {callingId
                  ? (requestUsesLocalUnitContext
                    ? 'Linked callings try to auto-detect the current holder inside the selected ward or branch. You can still search or type over it manually.'
                    : 'Linked callings try to auto-detect the current holder. You can still search or type over it manually.')
                  : 'Custom calling titles need a manual current-holder entry when one exists.'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Individual(s) Prayerfully Considered</Text>
          {nominees.map((entry, idx) => (
            <IndividualCard
              key={idx}
              entry={entry}
              index={idx}
              wards={individualWardOptions}
              callings={allCallings}
              token={token}
              onUpdate={(field, value) => updateNominee(idx, field, value)}
              onApplyDirectoryPerson={(person) => applyNomineeDirectoryPerson(idx, person)}
              onToggleRelease={(val) => setNominees(prev => prev.map((n, i) => i === idx ? { ...n, requires_release: val } : n))}
              onRemove={() => removeNominee(idx)}
              canRemove={nominees.length > 1}
            />
          ))}
          {nominees.length < 3 && (
            <Pressable onPress={addNominee} style={styles.addButton}>
              <Ionicons name="add-circle-outline" size={18} color={Colors.brand.primary} />
              <Text style={styles.addButtonText}>Add Another Individual</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Context & Background (Optional)</Text>
          <View style={styles.fieldsInner}>
            <TextInput
              style={styles.contextInput}
              value={contextNotes}
              onChangeText={setContextNotes}
              placeholder="Any additional context or background..."
              placeholderTextColor={Colors.brand.midGray}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.buttonRow}>
          <Pressable onPress={navigateBackToOrigin} style={styles.cancelBtn} testID="calling-create-cancel">
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => handleSubmit(true)}
            style={[styles.draftBtn, submitting && styles.disabledBtn]}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={Colors.brand.primary} />
            ) : (
              <Text style={styles.draftBtnText}>Save Draft</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => handleSubmit(false)}
            style={[styles.submitBtn, submitting && styles.disabledBtn]}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={Colors.brand.white} />
            ) : (
              <Text style={styles.submitBtnText}>Submit</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  noAccessText: { fontSize: 15, color: Colors.brand.darkGray, textAlign: 'center', marginTop: 12, fontFamily: 'Inter_400Regular' },
  backBtn: { marginTop: 16, backgroundColor: Colors.brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  backBtnText: { color: Colors.brand.white, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  scrollContent: { padding: 20 },
  section: {
    backgroundColor: Colors.brand.white, borderRadius: 14, padding: 20, marginBottom: 20,
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 2, 8), elevation: 2,
  },
  fieldsInner: {
    backgroundColor: Colors.brand.sectionBg, borderRadius: 14, padding: 16,
  },
  sectionTitle: {
    fontSize: 15, fontWeight: '700' as const, color: Colors.brand.dark, marginBottom: 16,
    fontFamily: 'Inter_700Bold', borderLeftWidth: 3, borderLeftColor: Colors.brand.primary, paddingLeft: 10,
  },
  hintText: { fontSize: 15, color: Colors.brand.midGray, marginTop: 4, fontFamily: 'Inter_400Regular', fontStyle: 'italic' as const },
  helperCallout: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.brand.darkGray,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Inter_500Medium',
  },
  assistWrap: { marginTop: 10 },
  assistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  assistButtonText: { fontSize: 13, color: '#1D4ED8', fontFamily: 'Inter_600SemiBold' },
  selectionSummary: { fontSize: 13, color: Colors.brand.primary, marginTop: 8, fontFamily: 'Inter_500Medium' },
  directoryLoading: { paddingVertical: 14 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addButtonText: { fontSize: 14, color: Colors.brand.primary, fontFamily: 'Inter_600SemiBold' },
  contextInput: {
    backgroundColor: Colors.brand.inputBg, borderRadius: 12, borderWidth: 1, borderColor: Colors.brand.inputBorder,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: Colors.brand.dark, fontFamily: 'Inter_400Regular',
    minHeight: 100,
  },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.brand.lightGray, backgroundColor: Colors.brand.white,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.darkGray, fontFamily: 'Inter_600SemiBold' },
  draftBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.brand.primary, backgroundColor: Colors.brand.white,
  },
  draftBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.primary, fontFamily: 'Inter_600SemiBold' },
  submitBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    backgroundColor: Colors.brand.primary,
  },
  submitBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.white, fontFamily: 'Inter_600SemiBold' },
  disabledBtn: { opacity: 0.6 },
});
