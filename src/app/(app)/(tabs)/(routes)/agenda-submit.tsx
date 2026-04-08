import React, { useEffect, useMemo, useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import { webShadowRgba } from '@/lib/web-styles';
import AppButton from '@/components/ui/AppButton';
import AppInput from '@/components/ui/AppInput';
import AppPickerTrigger from '@/components/ui/AppPickerTrigger';
import {
  useAgendaSubmissionDestination,
  useAgendaSubmissionDestinations,
  useSubmitEntityAgendaItem,
  type AgendaEntityType,
  type AgendaSubmissionDestination,
  type AgendaSubmissionDraftAgenda,
  type AgendaSubmissionSectionOption,
} from '@/lib/agenda-api';
import { getSingleParam } from '@/lib/navigation-return-target';

type Priority = 'low' | 'normal' | 'high';
type SubmitMode = 'generic' | 'specific';
type SubmitDestinationSummary = Pick<AgendaSubmissionDestination, 'entity_type' | 'entity_id' | 'entity_name' | 'draft_count'>;

const PRIORITY_COLORS: Record<Priority, { bg: string; text: string }> = {
  low: { bg: Colors.brand.sectionBg, text: Colors.brand.midGray },
  normal: { bg: Colors.brand.primary + '18', text: Colors.brand.primary },
  high: { bg: '#FEF2F2', text: '#DC2626' },
};

function entityKey(entityType: AgendaEntityType, entityId: number) {
  return `${entityType}:${entityId}`;
}

function draftLabel(agenda: AgendaSubmissionDraftAgenda | null) {
  if (!agenda) return 'No draft selected';

  return agenda.meeting_date_label
    ? `${agenda.title} · ${agenda.meeting_date_label}${agenda.meeting_time ? ` · ${agenda.meeting_time}` : ''}`
    : agenda.title;
}

export default function AgendaSubmitScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    entityType?: string | string[];
    entityId?: string | string[];
    agendaId?: string | string[];
    mode?: string | string[];
  }>();

  const paramEntityType = getSingleParam(params.entityType) as AgendaEntityType | undefined;
  const paramEntityId = Number(getSingleParam(params.entityId) || 0) || null;
  const paramAgendaId = Number(getSingleParam(params.agendaId) || 0) || null;
  const submitMode: SubmitMode = getSingleParam(params.mode) === 'specific' ? 'specific' : 'generic';
  const isSpecificMode = submitMode === 'specific' && !!paramEntityType && !!paramEntityId;
  const requestedDefaultEntityKey = paramEntityType && paramEntityId
    ? entityKey(paramEntityType, paramEntityId)
    : '';

  const destinationsQuery = useAgendaSubmissionDestinations();
  const destinations = useMemo(() => destinationsQuery.data?.entities ?? [], [destinationsQuery.data?.entities]);

  const [selectedEntityKey, setSelectedEntityKey] = useState(requestedDefaultEntityKey);
  const [selectedAgendaId, setSelectedAgendaId] = useState<number | null>(null);
  const [selectedSectionKey, setSelectedSectionKey] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [showDestinationMenu, setShowDestinationMenu] = useState(false);
  const [showDraftMenu, setShowDraftMenu] = useState(false);
  const [showSectionMenu, setShowSectionMenu] = useState(false);

  const mutation = useSubmitEntityAgendaItem();

  useEffect(() => {
    if (isSpecificMode) return;
    if (!destinations.length) return;

    const requestedStillExists = requestedDefaultEntityKey
      && destinations.some((destination) => entityKey(destination.entity_type, destination.entity_id) === requestedDefaultEntityKey);

    if (selectedEntityKey && destinations.some((destination) => entityKey(destination.entity_type, destination.entity_id) === selectedEntityKey)) {
      return;
    }

    setSelectedEntityKey(requestedStillExists
      ? requestedDefaultEntityKey
      : entityKey(destinations[0].entity_type, destinations[0].entity_id));
  }, [destinations, isSpecificMode, requestedDefaultEntityKey, selectedEntityKey]);

  const selectedGenericDestination = useMemo<AgendaSubmissionDestination | null>(() => (
    destinations.find((destination) => entityKey(destination.entity_type, destination.entity_id) === selectedEntityKey) ?? null
  ), [destinations, selectedEntityKey]);

  const destinationContextQuery = useAgendaSubmissionDestination(
    isSpecificMode ? paramEntityType ?? null : selectedGenericDestination?.entity_type ?? null,
    isSpecificMode ? paramEntityId ?? null : selectedGenericDestination?.entity_id ?? null,
  );

  const draftAgendas = useMemo(
    () => destinationContextQuery.data?.draft_agendas ?? [],
    [destinationContextQuery.data?.draft_agendas],
  );

  const selectedDestination = useMemo<SubmitDestinationSummary | null>(() => {
    if (isSpecificMode) {
      const entity = destinationContextQuery.data?.entity;
      if (!entity) {
        return null;
      }

      return {
        entity_type: entity.entity_type,
        entity_id: entity.entity_id,
        entity_name: entity.entity_name,
        draft_count: draftAgendas.length,
      };
    }

    if (!selectedGenericDestination) {
      return null;
    }

    return {
      entity_type: selectedGenericDestination.entity_type,
      entity_id: selectedGenericDestination.entity_id,
      entity_name: selectedGenericDestination.entity_name,
      draft_count: selectedGenericDestination.draft_count,
    };
  }, [destinationContextQuery.data?.entity, draftAgendas.length, isSpecificMode, selectedGenericDestination]);

  const requestedDraftExists = useMemo(
    () => Boolean(paramAgendaId && draftAgendas.some((agenda) => agenda.id === paramAgendaId)),
    [draftAgendas, paramAgendaId],
  );

  useEffect(() => {
    if (!selectedDestination) {
      setSelectedAgendaId(null);
      setSelectedSectionKey('');
      return;
    }

    if (!draftAgendas.length) {
      setSelectedAgendaId(null);
      setSelectedSectionKey('');
      return;
    }

    if (isSpecificMode && requestedDraftExists && paramAgendaId) {
      if (selectedAgendaId !== paramAgendaId) {
        setSelectedAgendaId(paramAgendaId);
      }
      return;
    }

    if (selectedAgendaId && draftAgendas.some((agenda) => agenda.id === selectedAgendaId)) {
      return;
    }

    setSelectedAgendaId(draftAgendas[0].id);
  }, [draftAgendas, isSpecificMode, paramAgendaId, requestedDraftExists, selectedAgendaId, selectedDestination]);

  const selectedDraftAgenda = useMemo<AgendaSubmissionDraftAgenda | null>(() => (
    draftAgendas.find((agenda) => agenda.id === selectedAgendaId) ?? null
  ), [draftAgendas, selectedAgendaId]);

  const availableSections = useMemo<AgendaSubmissionSectionOption[]>(() => (
    (selectedDraftAgenda?.sections ?? []).filter((section) => section.is_available)
  ), [selectedDraftAgenda]);

  useEffect(() => {
    if (!selectedDraftAgenda) {
      setSelectedSectionKey('');
      return;
    }

    if (selectedSectionKey && availableSections.some((section) => section.key === selectedSectionKey)) {
      return;
    }

    setSelectedSectionKey(availableSections[0]?.key ?? '');
  }, [availableSections, selectedDraftAgenda, selectedSectionKey]);

  const selectedSection = useMemo(() => (
    selectedDraftAgenda?.sections.find((section) => section.key === selectedSectionKey) ?? null
  ), [selectedDraftAgenda, selectedSectionKey]);

  const isDestinationListLoading = !isSpecificMode && destinationsQuery.isLoading;
  const isDestinationListError = !isSpecificMode && destinationsQuery.isError;
  const hasDestinationContextError = Boolean(selectedDestination && destinationContextQuery.isError);
  const showLockedDraftContext = isSpecificMode && requestedDraftExists && !!selectedDraftAgenda;
  const showDraftPicker = !showLockedDraftContext;

  const destinationHelperText = !selectedDestination
    ? 'Choose a council, committee, or organization.'
    : hasDestinationContextError
      ? 'Unable to load the live drafts for this meeting group right now.'
      : selectedDestination.draft_count > 0
      ? `${selectedDestination.draft_count} draft meeting${selectedDestination.draft_count === 1 ? '' : 's'} available right now.`
      : 'No draft meeting exists yet. Your item will stay in the Meeting Inbox until one is created.';

  const draftHelperText = !selectedDestination
    ? 'Choose where this topic should go first.'
    : destinationContextQuery.isLoading
      ? 'Loading the live drafts for this meeting group.'
    : hasDestinationContextError
      ? 'Tap Retry to load the latest draft meetings and sections.'
    : showLockedDraftContext
      ? 'This topic is tied to the draft meeting you opened.'
    : !draftAgendas.length
      ? 'No draft meeting exists yet. Your item will stay in the Meeting Inbox until one is created.'
      : isSpecificMode
        ? 'If this draft changed, choose another draft below.'
      : 'Choose a draft meeting if one already exists.';

  const sectionHelperText = !selectedDraftAgenda
    ? hasDestinationContextError
      ? 'Retry loading this meeting group first.'
      : 'Choose a draft meeting first.'
    : selectedDraftAgenda.sections.length === 0
      ? 'That draft has no live sections yet. Your item will stay in the Meeting Inbox until sections are added.'
      : availableSections.length === 0
        ? 'The visible sections on that draft are already filled for protected slots. Your item will stay in the Meeting Inbox until the draft changes.'
        : 'Choose the live section this topic belongs in.';

  const canSubmit = Boolean(
    selectedDestination
      && title.trim()
      && !hasDestinationContextError
      && (!selectedDraftAgenda || availableSections.length === 0 || selectedSectionKey)
  );

  const handleSubmit = () => {
    if (!selectedDestination || !title.trim()) return;

    if (selectedDraftAgenda && availableSections.length > 0 && !selectedSectionKey) {
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    mutation.mutate({
      entityType: selectedDestination.entity_type,
      entityId: selectedDestination.entity_id,
      agenda_id: selectedDraftAgenda?.id,
      section_key: selectedSectionKey || undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
    }, {
      onSuccess: () => {
        router.back();
      },
    });
  };

  const closeMenus = () => {
    setShowDestinationMenu(false);
    setShowDraftMenu(false);
    setShowSectionMenu(false);
  };

  if (isDestinationListLoading || (isSpecificMode && destinationContextQuery.isLoading && !destinationContextQuery.data)) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: isSpecificMode ? 'Add to Draft' : 'Submit Topic' }} />
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={styles.loadingText}>
          {isSpecificMode ? 'Loading this meeting draft...' : 'Loading agenda destinations...'}
        </Text>
      </View>
    );
  }

  if (isDestinationListError || (isSpecificMode && destinationContextQuery.isError)) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: isSpecificMode ? 'Add to Draft' : 'Submit Topic' }} />
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.brand.error} />
        <Text style={styles.errorTitle}>
          {isSpecificMode ? 'Unable to load this meeting' : 'Unable to load agenda destinations'}
        </Text>
        <Text style={styles.errorText}>
          {isSpecificMode
            ? 'Retry to load the latest draft and section list for this meeting.'
            : 'Retry to load the places where you can submit a topic.'}
        </Text>
        <Pressable
          onPress={() => {
            if (isSpecificMode) {
              destinationContextQuery.refetch();
              return;
            }
            destinationsQuery.refetch();
          }}
          style={styles.retryBtn}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Stack.Screen options={{ title: isSpecificMode ? 'Add to Draft' : 'Submit Topic' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + WEB_BOTTOM_INSET + 28 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={closeMenus} style={styles.contentWrap}>
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={24} color={Colors.brand.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{isSpecificMode ? 'Add Topic to This Draft' : 'Submit Agenda Item'}</Text>
              <Text style={styles.heroSubtitle}>
                {isSpecificMode
                  ? 'This path is tied to one meeting. Choose the live section from this draft, or send the topic into the Meeting Inbox if the draft is not ready yet.'
                  : 'Choose the destination first. If a draft already exists, you can place the item into one of its live sections now.'}
              </Text>
            </View>
          </View>

          {!isSpecificMode && destinations.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="clipboard-clock-outline" size={30} color={Colors.brand.primary} />
              <Text style={styles.emptyTitle}>No agenda destinations are available</Text>
              <Text style={styles.emptySubtitle}>As soon as you have permission to submit to a meeting inbox, it will appear here.</Text>
            </View>
          ) : (
            <View style={styles.formCard}>
              {isSpecificMode ? (
                <View style={styles.contextCard}>
                  <Text style={styles.contextKicker}>Meeting</Text>
                  <Text style={styles.contextTitle}>{selectedDestination?.entity_name || 'Loading meeting group...'}</Text>
                  <Text style={styles.contextBody}>
                    {showLockedDraftContext
                      ? `Draft selected: ${draftLabel(selectedDraftAgenda)}`
                      : 'This quick-add path is locked to this meeting group. If the original draft changed, you can choose another draft below.'}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.label}>Where should this go? *</Text>
                  <AppPickerTrigger
                    label={selectedDestination?.entity_name ?? 'Choose a council, committee, or organization'}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                      setShowDestinationMenu((current) => !current);
                      setShowDraftMenu(false);
                      setShowSectionMenu(false);
                    }}
                    style={{ marginBottom: showDestinationMenu ? 8 : 6 }}
                  />
                  {showDestinationMenu ? (
                    <View style={styles.menuCard}>
                      {destinations.map((destination) => {
                        const selected = selectedEntityKey === entityKey(destination.entity_type, destination.entity_id);
                        return (
                          <Pressable
                            key={entityKey(destination.entity_type, destination.entity_id)}
                            onPress={() => {
                              if (Platform.OS !== 'web') Haptics.selectionAsync();
                              setSelectedEntityKey(entityKey(destination.entity_type, destination.entity_id));
                              setSelectedAgendaId(null);
                              setSelectedSectionKey('');
                              setShowDestinationMenu(false);
                            }}
                            style={[styles.menuOption, selected && styles.menuOptionSelected]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.menuOptionTitle, selected && styles.menuOptionTitleSelected]}>
                                {destination.entity_name}
                              </Text>
                              <Text style={styles.menuOptionSubtitle}>
                                {destination.draft_count > 0
                                  ? `${destination.draft_count} draft meeting${destination.draft_count === 1 ? '' : 's'}`
                                  : 'Meeting Inbox only right now'}
                              </Text>
                            </View>
                            {selected ? <Ionicons name="checkmark" size={16} color={Colors.brand.primary} /> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                  <Text style={styles.helperText}>{destinationHelperText}</Text>
                </>
              )}

              {showDraftPicker ? (
                <>
                  <Text style={styles.label}>Which draft meeting?</Text>
                  <AppPickerTrigger
                    label={draftLabel(selectedDraftAgenda)}
                    onPress={() => {
                      if (!selectedDestination || !draftAgendas.length) return;
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                      setShowDraftMenu((current) => !current);
                      setShowDestinationMenu(false);
                      setShowSectionMenu(false);
                    }}
                    style={{ marginBottom: showDraftMenu ? 8 : 6 }}
                    disabled={!selectedDestination || !draftAgendas.length || destinationContextQuery.isLoading}
                  />
                  {showDraftMenu ? (
                    <View style={styles.menuCard}>
                      {draftAgendas.map((agenda) => {
                        const selected = selectedAgendaId === agenda.id;
                        return (
                          <Pressable
                            key={agenda.id}
                            onPress={() => {
                              if (Platform.OS !== 'web') Haptics.selectionAsync();
                              setSelectedAgendaId(agenda.id);
                              setSelectedSectionKey('');
                              setShowDraftMenu(false);
                            }}
                            style={[styles.menuOption, selected && styles.menuOptionSelected]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.menuOptionTitle, selected && styles.menuOptionTitleSelected]}>
                                {agenda.title}
                              </Text>
                              <Text style={styles.menuOptionSubtitle}>
                                {agenda.meeting_date_label || 'Draft meeting'}{agenda.meeting_time ? ` · ${agenda.meeting_time}` : ''}
                              </Text>
                            </View>
                            {selected ? <Ionicons name="checkmark" size={16} color={Colors.brand.primary} /> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                  <Text style={styles.helperText}>{draftHelperText}</Text>
                </>
              ) : (
                <Text style={styles.helperText}>{draftHelperText}</Text>
              )}

              {hasDestinationContextError ? (
                <Pressable
                  onPress={() => destinationContextQuery.refetch()}
                  style={styles.inlineRetryBtn}
                >
                  <Text style={styles.inlineRetryText}>Retry loading this meeting</Text>
                </Pressable>
              ) : null}

              <Text style={styles.label}>Which section?</Text>
              <AppPickerTrigger
                label={selectedSection?.title ?? 'Choose a section'}
                onPress={() => {
                  if (!selectedDraftAgenda || selectedDraftAgenda.sections.length === 0) return;
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                  setShowSectionMenu((current) => !current);
                  setShowDestinationMenu(false);
                  setShowDraftMenu(false);
                }}
                style={{ marginBottom: showSectionMenu ? 8 : 6 }}
                disabled={!selectedDraftAgenda || selectedDraftAgenda.sections.length === 0}
              />
              {showSectionMenu ? (
                <View style={styles.menuCard}>
                  {selectedDraftAgenda?.sections.map((section) => {
                    const selected = selectedSectionKey === section.key;
                    const disabled = !section.is_available;
                    return (
                      <Pressable
                        key={section.key}
                        onPress={() => {
                          if (disabled) return;
                          if (Platform.OS !== 'web') Haptics.selectionAsync();
                          setSelectedSectionKey(section.key);
                          setShowSectionMenu(false);
                        }}
                        style={[
                          styles.menuOption,
                          selected && styles.menuOptionSelected,
                          disabled && styles.menuOptionDisabled,
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[
                            styles.menuOptionTitle,
                            selected && styles.menuOptionTitleSelected,
                            disabled && styles.menuOptionTitleDisabled,
                          ]}>
                            {section.title}
                          </Text>
                          <Text style={styles.menuOptionSubtitle}>
                            {disabled ? 'Filled protected slot' : `${section.item_count} item${section.item_count === 1 ? '' : 's'} already in this section`}
                          </Text>
                        </View>
                        {selected ? <Ionicons name="checkmark" size={16} color={Colors.brand.primary} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <Text style={styles.helperText}>{sectionHelperText}</Text>

              <Text style={styles.label}>Title *</Text>
              <AppInput
                value={title}
                onChangeText={setTitle}
                placeholder="What should be discussed?"
                maxLength={255}
                style={{ marginBottom: 14 }}
              />

              <Text style={styles.label}>Description</Text>
              <AppInput
                value={description}
                onChangeText={setDescription}
                placeholder="Add context or notes for the reviewer"
                multiline
                numberOfLines={4}
                maxLength={2000}
                style={{ marginBottom: 14, minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }}
              />

              <Text style={styles.label}>Priority</Text>
              <View style={styles.priorityRow}>
                {(['low', 'normal', 'high'] as const).map((option) => {
                  const active = priority === option;
                  const colors = PRIORITY_COLORS[option];
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                        setPriority(option);
                      }}
                      style={[
                        styles.priorityChip,
                        {
                          backgroundColor: active ? colors.bg : Colors.brand.sectionBg,
                          borderColor: active ? colors.text : 'transparent',
                        },
                      ]}
                    >
                      <Text style={[styles.priorityChipText, { color: active ? colors.text : Colors.brand.midGray }]}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {mutation.isError ? (
                <Text style={styles.errorInline}>{mutation.error?.message || 'Submission failed.'}</Text>
              ) : null}

              <AppButton
                label="Submit Topic"
                onPress={handleSubmit}
                loading={mutation.isPending}
                disabled={!canSubmit}
                style={{ marginTop: 6 }}
              />
            </View>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 15, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },
  errorTitle: { marginTop: 16, fontSize: 20, color: Colors.brand.black, fontFamily: 'Inter_600SemiBold' },
  errorText: { marginTop: 6, fontSize: 15, color: Colors.brand.darkGray, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  retryBtn: {
    marginTop: 18,
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { fontSize: 15, color: Colors.brand.white, fontFamily: 'Inter_600SemiBold' },
  scroll: { flex: 1 },
  contentWrap: { width: '100%', maxWidth: 860, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16 },
  heroCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginBottom: 14,
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 3, 10),
    elevation: 3,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.brand.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1 },
  heroTitle: { fontSize: 22, color: Colors.brand.black, fontFamily: 'Inter_700Bold' },
  heroSubtitle: { marginTop: 4, fontSize: 15, lineHeight: 21, color: Colors.brand.darkGray, fontFamily: 'Inter_400Regular' },
  formCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 18,
    padding: 18,
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 3, 10),
    elevation: 3,
  },
  contextCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    backgroundColor: Colors.brand.sectionBg,
    padding: 14,
    marginBottom: 14,
  },
  contextKicker: {
    fontSize: 12,
    color: Colors.brand.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Inter_700Bold',
  },
  contextTitle: {
    marginTop: 6,
    fontSize: 17,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  contextBody: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  emptyCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 3, 10),
    elevation: 3,
  },
  emptyTitle: { marginTop: 12, fontSize: 20, color: Colors.brand.black, fontFamily: 'Inter_600SemiBold' },
  emptySubtitle: { marginTop: 6, fontSize: 15, lineHeight: 21, color: Colors.brand.darkGray, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  label: { marginBottom: 8, fontSize: 14, color: Colors.brand.darkGray, fontFamily: 'Inter_600SemiBold' },
  helperText: { marginTop: 2, marginBottom: 14, fontSize: 13, lineHeight: 18, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },
  inlineRetryBtn: {
    alignSelf: 'flex-start',
    marginTop: -4,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.brand.primary + '12',
  },
  inlineRetryText: {
    fontSize: 13,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  menuCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    backgroundColor: Colors.brand.inputBg,
    overflow: 'hidden',
    marginBottom: 6,
  },
  menuOption: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.inputBorder,
    gap: 10,
  },
  menuOptionSelected: {
    backgroundColor: Colors.brand.primary + '10',
  },
  menuOptionDisabled: {
    opacity: 0.55,
  },
  menuOptionTitle: { fontSize: 15, color: Colors.brand.dark, fontFamily: 'Inter_500Medium' },
  menuOptionTitleSelected: { color: Colors.brand.primary, fontFamily: 'Inter_600SemiBold' },
  menuOptionTitleDisabled: { color: Colors.brand.midGray },
  menuOptionSubtitle: { marginTop: 2, fontSize: 13, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  priorityChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  priorityChipText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  errorInline: { color: Colors.brand.error, fontSize: 14, marginBottom: 12, fontFamily: 'Inter_500Medium' },
});
