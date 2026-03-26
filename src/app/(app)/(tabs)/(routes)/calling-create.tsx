import React, { useState, useEffect, useCallback, useRef } from 'react';
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

interface Ward { id: number; name: string; }
interface CallingOption { id: number; name: string; level?: string; organization_type?: string; }
interface OrgOption { id: number; name: string; type?: string; }
interface Holder { user_id: number; user_name: string; label: string; ward_id?: number | null; }
interface SubmissionContext {
  allowed_scopes: ('stake' | 'ward')[];
  allowed_wards: Ward[] | null;
  can_create: boolean;
}

interface NomineeEntry {
  name: string;
  ward_id: string;
  current_calling_id: string;
  requires_release: boolean;
  recommendation: string;
}

function emptyNominee(): NomineeEntry {
  return { name: '', ward_id: '', current_calling_id: '', requires_release: true, recommendation: '' };
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

function IndividualCard({ entry, index, wards, callings, onUpdate, onToggleRelease, onRemove, canRemove }: {
  entry: NomineeEntry;
  index: number;
  wards: { value: string; label: string }[];
  callings: { value: string; label: string }[];
  onUpdate: (field: keyof NomineeEntry, value: string) => void;
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
      {!!entry.current_calling_id && (
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
  const [wardId, setWardId] = useState<string>('');
  const [callingId, setCallingId] = useState<string>('');
  const [orgId, setOrgId] = useState<string>('');
  const [currentHolderUserId, setCurrentHolderUserId] = useState<string>('');
  const [currentHolderName, setCurrentHolderName] = useState<string>('');
  const [contextNotes, setContextNotes] = useState('');
  const [nominees, setNominees] = useState<NomineeEntry[]>([emptyNominee()]);
  const [submitting, setSubmitting] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const navigateBackToOrigin = useCallback(() => {
    navigateToReturnTarget(router, pathname, returnTo);
  }, [pathname, returnTo]);

  // Warn if navigating away with unsaved changes
  useEffect(() => {
    const hasChanges = !!(callingId || contextNotes.trim() || nominees.some(n => n.name.trim()));
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
  }, [navigation, callingId, contextNotes, nominees]);


  const { data: ctx, isLoading: ctxLoading, refetch: refetchSubmissionContext } = useQuery<SubmissionContext>({
    queryKey: ['/api/calling-requests/submission-context'],
    queryFn: () => authFetch(token, '/api/calling-requests/submission-context'),
    enabled: !!token,
  });

  const { data: allWards, refetch: refetchWards } = useQuery<{ wards?: Ward[]; data?: Ward[] }>({
    queryKey: ['/api/reference/wards'],
    queryFn: () => authFetch(token, '/api/reference/wards'),
    enabled: !!token,
  });

  const { data: callingsData, refetch: refetchCallings } = useQuery<{ callings?: CallingOption[]; data?: CallingOption[] }>({
    queryKey: ['/api/reference/callings', scope],
    queryFn: () => authFetch(token, '/api/reference/callings', { params: scope ? { scope } : {} }),
    enabled: !!token && !!scope,
  });

  const { data: orgsData, refetch: refetchOrganizations } = useQuery<{ organizations?: OrgOption[]; data?: OrgOption[] }>({
    queryKey: ['/api/reference/organizations', scope, wardId],
    queryFn: () => authFetch(token, '/api/reference/organizations', {
      params: scope === 'stake'
        ? { level: 'stake' }
        : { level: 'ward', ward_id: wardId },
    }),
    enabled: !!token && !!scope && (scope === 'stake' || !!wardId),
  });

  const { data: holdersData, refetch: refetchCurrentHolders } = useQuery<{ holders?: Holder[]; data?: Holder[] }>({
    queryKey: ['/api/reference/current-holders', callingId, wardId],
    queryFn: () => authFetch(token, `/api/reference/current-holders/${callingId}`, {
      params: wardId ? { ward_id: wardId } : {},
    }),
    enabled: !!token && !!callingId,
  });

  const { data: allCallingsData, refetch: refetchAllCallings } = useQuery<{ callings?: CallingOption[]; data?: CallingOption[] }>({
    queryKey: ['/api/reference/callings', 'all'],
    queryFn: () => authFetch(token, '/api/reference/callings'),
    enabled: !!token,
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
      if (scope && (scope === 'stake' || !!wardId)) {
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
    wardId,
    callingId,
  ]);

  useEffect(() => {
    if (ctx?.allowed_scopes?.length === 1) {
      setScope(ctx.allowed_scopes[0]);
    }
    if (ctx?.allowed_wards?.length === 1) {
      setWardId(String(ctx.allowed_wards[0].id));
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
      const matched = wardId
        ? holders.find((h) => String(h.ward_id) === wardId)
        : holders[0];
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
    setNominees(prev => prev.map((n, i) => {
      if (i !== idx) return n;
      const updated = { ...n, [field]: value };
      if (field === 'current_calling_id') updated.requires_release = !!value;
      return updated;
    }));
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
      appAlert('Required', 'Please add at least one individual.');
      return;
    }
    if (!callingId) {
      appAlert('Required', 'Please select a calling.');
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
          requires_release: n.current_calling_id ? n.requires_release : undefined,
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calling</Text>
          <View style={styles.fieldsInner}>
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Individual(s) Prayerfully Considered</Text>
          {nominees.map((entry, idx) => (
            <IndividualCard
              key={idx}
              entry={entry}
              index={idx}
              wards={individualWardOptions}
              callings={individualCallingOptions}
              onUpdate={(field, value) => updateNominee(idx, field, value)}
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
