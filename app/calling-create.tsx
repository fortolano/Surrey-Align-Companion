import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import Colors from '@/constants/colors';

interface Ward { id: number; name: string; }
interface CallingOption { id: number; name: string; level?: string; organization_type?: string; }
interface OrgOption { id: number; name: string; type?: string; }
interface Holder { user_id: number; user_name: string; label: string; }
interface SubmissionContext {
  allowed_scopes: ('stake' | 'ward')[];
  allowed_wards: Ward[] | null;
  can_create: boolean;
}

interface NomineeEntry {
  name: string;
  ward_id: string;
  current_calling_id: string;
  recommendation: string;
}

function emptyNominee(): NomineeEntry {
  return { name: '', ward_id: '', current_calling_id: '', recommendation: '' };
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
  container: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600' as const, color: Colors.brand.darkGray, marginBottom: 6, fontFamily: 'Inter_600SemiBold' },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.brand.offWhite, borderRadius: 10, borderWidth: 1, borderColor: Colors.brand.lightGray,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  disabled: { opacity: 0.5 },
  triggerText: { fontSize: 14, color: Colors.brand.dark, fontFamily: 'Inter_400Regular', flex: 1, marginRight: 8 },
  placeholder: { color: Colors.brand.midGray },
  dropdown: {
    marginTop: 4, backgroundColor: Colors.brand.white, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.brand.lightGray, overflow: 'hidden',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }, android: { elevation: 4 } }),
  },
  dropdownScroll: { maxHeight: 220 },
  option: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.brand.lightGray },
  optionActive: { backgroundColor: Colors.brand.accent },
  optionText: { fontSize: 14, color: Colors.brand.dark, fontFamily: 'Inter_400Regular' },
  optionTextActive: { color: Colors.brand.primary, fontFamily: 'Inter_600SemiBold' },
});

function IndividualCard({ entry, index, wards, callings, onUpdate, onRemove, canRemove }: {
  entry: NomineeEntry;
  index: number;
  wards: { value: string; label: string }[];
  callings: { value: string; label: string }[];
  onUpdate: (field: keyof NomineeEntry, value: string) => void;
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
      </View>
      <PickerField
        label="Ward"
        value={entry.ward_id}
        options={wards}
        onChange={v => onUpdate('ward_id', v)}
        placeholder="Select Ward"
      />
      <PickerField
        label="Current Calling"
        value={entry.current_calling_id}
        options={callings}
        onChange={v => onUpdate('current_calling_id', v)}
        placeholder="Select Calling"
      />
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
  card: { backgroundColor: Colors.brand.offWhite, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.brand.lightGray },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerText: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.primary, fontFamily: 'Inter_600SemiBold' },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600' as const, color: Colors.brand.darkGray, marginBottom: 6, fontFamily: 'Inter_600SemiBold' },
  input: {
    backgroundColor: Colors.brand.white, borderRadius: 10, borderWidth: 1, borderColor: Colors.brand.lightGray,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.brand.dark, fontFamily: 'Inter_400Regular',
  },
  multiline: { minHeight: 70, paddingTop: 12 },
});

export default function CallingCreateScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const qClient = useQueryClient();
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const [scope, setScope] = useState<string>('');
  const [wardId, setWardId] = useState<string>('');
  const [callingId, setCallingId] = useState<string>('');
  const [orgId, setOrgId] = useState<string>('');
  const [currentHolderUserId, setCurrentHolderUserId] = useState<string>('');
  const [currentHolderName, setCurrentHolderName] = useState<string>('');
  const [contextNotes, setContextNotes] = useState('');
  const [nominees, setNominees] = useState<NomineeEntry[]>([emptyNominee()]);
  const [submitting, setSubmitting] = useState(false);

  const { data: ctx, isLoading: ctxLoading } = useQuery<SubmissionContext>({
    queryKey: ['/api/calling-requests/submission-context'],
    queryFn: () => authFetch(token, '/api/calling-requests/submission-context'),
    enabled: !!token,
  });

  const { data: allWards } = useQuery<{ wards?: Ward[]; data?: Ward[] }>({
    queryKey: ['/api/reference/wards'],
    queryFn: () => authFetch(token, '/api/reference/wards'),
    enabled: !!token,
  });

  const { data: callingsData } = useQuery<{ callings?: CallingOption[]; data?: CallingOption[] }>({
    queryKey: ['/api/reference/callings', scope],
    queryFn: () => authFetch(token, '/api/reference/callings', { params: scope ? { scope } : {} }),
    enabled: !!token && !!scope,
  });

  const { data: orgsData } = useQuery<{ organizations?: OrgOption[]; data?: OrgOption[] }>({
    queryKey: ['/api/reference/organizations', scope, wardId],
    queryFn: () => authFetch(token, '/api/reference/organizations', {
      params: scope === 'stake'
        ? { level: 'stake' }
        : { level: 'ward', ward_id: wardId },
    }),
    enabled: !!token && !!scope && (scope === 'stake' || !!wardId),
  });

  const { data: holdersData } = useQuery<{ holders?: Holder[]; data?: Holder[] }>({
    queryKey: ['/api/reference/current-holders', callingId],
    queryFn: () => authFetch(token, `/api/reference/current-holders/${callingId}`),
    enabled: !!token && !!callingId,
  });

  const { data: allCallingsData } = useQuery<{ callings?: CallingOption[]; data?: CallingOption[] }>({
    queryKey: ['/api/reference/callings', 'all'],
    queryFn: () => authFetch(token, '/api/reference/callings'),
    enabled: !!token,
  });

  useEffect(() => {
    if (ctx?.allowed_scopes?.length === 1) {
      setScope(ctx.allowed_scopes[0]);
    }
  }, [ctx]);

  useEffect(() => {
    setCallingId('');
    setOrgId('');
    setCurrentHolderUserId('');
    setCurrentHolderName('');
  }, [scope, wardId]);

  useEffect(() => {
    setCurrentHolderUserId('');
    setCurrentHolderName('');
    const holders = holdersData?.holders || holdersData?.data || [];
    if (holders.length > 0) {
      const matched = holders.find(h => String(h.user_id) && wardId && h.label?.includes(wardId)) || holders[0];
      if (matched) {
        setCurrentHolderUserId(String(matched.user_id));
        setCurrentHolderName(matched.user_name);
      }
    }
  }, [holdersData, wardId]);

  useEffect(() => {
    const callings = callingsData?.callings || callingsData?.data || [];
    const orgs = orgsData?.organizations || orgsData?.data || [];
    if (callingId && orgs.length > 0) {
      const calling = callings.find(c => String(c.id) === callingId);
      if (calling?.organization_type) {
        const match = orgs.find(o => o.type === calling.organization_type);
        if (match) setOrgId(String(match.id));
      }
    }
  }, [callingId, orgsData, callingsData]);

  const wardsForForm = ctx?.allowed_wards || allWards?.wards || allWards?.data || [];
  const callings = callingsData?.callings || callingsData?.data || [];
  const orgs = orgsData?.organizations || orgsData?.data || [];
  const allCallings = allCallingsData?.callings || allCallingsData?.data || [];

  const wardOptions = wardsForForm.map(w => ({ value: String(w.id), label: w.name }));
  const callingOptions = callings.map(c => ({ value: String(c.id), label: c.name }));
  const orgOptions = orgs.map(o => ({ value: String(o.id), label: o.name }));
  const individualCallingOptions = [{ value: '', label: 'None' }, ...allCallings.map(c => ({ value: String(c.id), label: c.name }))];
  const individualWardOptions = wardsForForm.map(w => ({ value: String(w.id), label: w.name }));

  const updateNominee = useCallback((idx: number, field: keyof NomineeEntry, value: string) => {
    setNominees(prev => prev.map((n, i) => i === idx ? { ...n, [field]: value } : n));
  }, []);

  const removeNominee = useCallback((idx: number) => {
    setNominees(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const addNominee = useCallback(() => {
    if (nominees.length < 3) setNominees(prev => [...prev, emptyNominee()]);
  }, [nominees.length]);

  const handleSubmit = async (asDraft: boolean) => {
    const validNominees = nominees.filter(n => n.name.trim());
    if (validNominees.length === 0) {
      Alert.alert('Required', 'Please add at least one individual.');
      return;
    }
    if (!callingId) {
      Alert.alert('Required', 'Please select a calling.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        request_type: 'calling',
        scope,
        target_calling_id: Number(callingId),
        nominees: validNominees.map(n => ({
          name: n.name.trim(),
          user_id: null,
          ward_id: n.ward_id ? Number(n.ward_id) : null,
          current_calling_id: n.current_calling_id ? Number(n.current_calling_id) : null,
          recommendation: n.recommendation.trim() || null,
        })),
      };
      if (orgId) payload.target_organization_id = Number(orgId);
      if (wardId) {
        payload.target_ward_id = Number(wardId);
        payload.ward_id = Number(wardId);
      }
      if (currentHolderUserId) payload.current_holder_user_id = Number(currentHolderUserId);
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
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create request.');
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
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
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
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Request Details</Text>
          <PickerField
            label="Request Type"
            value="calling"
            options={[{ value: 'calling', label: 'Calling' }]}
            onChange={() => {}}
            disabled
          />
          {ctx && ctx.allowed_scopes.length > 1 ? (
            <PickerField
              label="Scope"
              value={scope}
              options={ctx.allowed_scopes.map(s => ({ value: s, label: s === 'stake' ? 'Stake' : 'Ward' }))}
              onChange={v => { setScope(v); setWardId(''); }}
              placeholder="Select Scope"
            />
          ) : (
            <View style={pfStyles.container}>
              <Text style={pfStyles.label}>Scope</Text>
              <View style={[pfStyles.trigger, pfStyles.disabled]}>
                <Text style={pfStyles.triggerText}>{scope === 'stake' ? 'Stake' : 'Ward'}</Text>
              </View>
            </View>
          )}
          {scope === 'ward' && (
            <PickerField
              label="Ward"
              value={wardId}
              options={wardOptions}
              onChange={setWardId}
              placeholder="Select Ward"
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Calling</Text>
          <PickerField
            label="Calling"
            value={callingId}
            options={callingOptions}
            onChange={setCallingId}
            placeholder={scope ? 'Select Calling' : 'Select scope first'}
            disabled={!scope}
          />
          <PickerField
            label="Organization"
            value={orgId}
            options={orgOptions}
            onChange={setOrgId}
            placeholder="Select Organization"
            disabled={orgs.length === 0}
          />
          <View style={pfStyles.container}>
            <Text style={pfStyles.label}>Current Holder</Text>
            <View style={[pfStyles.trigger, pfStyles.disabled]}>
              <Text style={[pfStyles.triggerText, !currentHolderName && pfStyles.placeholder]}>
                {currentHolderName || (callingId ? 'Calling is currently vacant' : 'Select a calling first')}
              </Text>
            </View>
            {currentHolderName ? (
              <Text style={styles.hintText}>Auto-detected</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Individual(s) Prayerfully Considered</Text>
          {nominees.map((entry, idx) => (
            <IndividualCard
              key={idx}
              entry={entry}
              index={idx}
              wards={individualWardOptions}
              callings={individualCallingOptions}
              onUpdate={(field, value) => updateNominee(idx, field, value)}
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
          <Text style={styles.sectionTitle}>4. Context & Background (Optional)</Text>
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

        <View style={styles.buttonRow}>
          <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
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
  scrollContent: { padding: 16 },
  section: {
    backgroundColor: Colors.brand.white, borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.brand.lightGray,
  },
  sectionTitle: {
    fontSize: 15, fontWeight: '700' as const, color: Colors.brand.dark, marginBottom: 14,
    fontFamily: 'Inter_700Bold',
  },
  hintText: { fontSize: 11, color: Colors.brand.midGray, marginTop: 4, fontFamily: 'Inter_400Regular', fontStyle: 'italic' as const },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addButtonText: { fontSize: 14, color: Colors.brand.primary, fontFamily: 'Inter_600SemiBold' },
  contextInput: {
    backgroundColor: Colors.brand.offWhite, borderRadius: 10, borderWidth: 1, borderColor: Colors.brand.lightGray,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.brand.dark, fontFamily: 'Inter_400Regular',
    minHeight: 100,
  },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.brand.lightGray, backgroundColor: Colors.brand.white,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.darkGray, fontFamily: 'Inter_600SemiBold' },
  draftBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.brand.primary, backgroundColor: Colors.brand.white,
  },
  draftBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.primary, fontFamily: 'Inter_600SemiBold' },
  submitBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: Colors.brand.primary,
  },
  submitBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.white, fontFamily: 'Inter_600SemiBold' },
  disabledBtn: { opacity: 0.6 },
});
