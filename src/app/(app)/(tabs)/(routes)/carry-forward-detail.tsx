import React, { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { webShadowRgba } from '@/lib/web-styles';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import { ApiResponseError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { appAlert } from '@/lib/platform-alert';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import { getSingleParam, navigateToReturnTarget } from '@/lib/navigation-return-target';
import AppButton from '@/components/ui/AppButton';
import AppStatusBadge from '@/components/ui/AppStatusBadge';
import {
  buildCarryForwardMeetingInstanceKey,
  useCarryForwardItem,
  useCarryForwardUserSearch,
  useDismissCarryForwardItem,
  useRequestCarryForwardReport,
  useResolveCarryForwardItem,
  useRespondToCarryForwardReport,
  type CarryForwardReportRequestSummary,
} from '@/lib/carry-forward-api';
import type { AgendaEntityType } from '@/lib/agenda-api';

function statusTone(status: string) {
  if (status === 'waiting_for_report') {
    return { backgroundColor: '#FEF3C7', textColor: '#92400E' };
  }

  if (status === 'resolved') {
    return { backgroundColor: '#D1FAE5', textColor: '#065F46' };
  }

  return { backgroundColor: '#E8F4F8', textColor: Colors.brand.primary };
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;

  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D1D5DB', true: Colors.brand.primary + '60' }}
        thumbColor={value ? Colors.brand.primary : '#F8FAFC'}
      />
    </View>
  );
}

function RequestReportSheet({
  visible,
  query,
  onQueryChange,
  selectedLabel,
  results,
  isSearching,
  prompt,
  onPromptChange,
  decisionExpected,
  onDecisionExpectedChange,
  onSelectUser,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  visible: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  selectedLabel: string | null;
  results: { id: number; label: string }[];
  isSearching: boolean;
  prompt: string;
  onPromptChange: (value: string) => void;
  decisionExpected: boolean;
  onDecisionExpectedChange: (value: boolean) => void;
  onSelectUser: (id: number, label: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request report-back</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.brand.midGray} />
            </Pressable>
          </View>
          <Text style={styles.modalSubtitle}>
            Choose the leader who should respond, then add an optional prompt.
          </Text>

          <Text style={styles.inputLabel}>Search leaders</Text>
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Type at least 2 letters"
            placeholderTextColor={Colors.brand.midGray}
            style={styles.input}
            autoCapitalize="words"
          />

          {selectedLabel ? (
            <View style={styles.selectedChip}>
              <Text style={styles.selectedChipText}>{selectedLabel}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
            {isSearching ? (
              <View style={styles.inlineState}>
                <ActivityIndicator size="small" color={Colors.brand.primary} />
                <Text style={styles.inlineStateText}>Searching leaders...</Text>
              </View>
            ) : null}

            {!isSearching && query.trim().length >= 2 && results.length === 0 ? (
              <Text style={styles.emptySearchText}>No leaders matched that search.</Text>
            ) : null}

            {results.map((result) => (
              <Pressable
                key={result.id}
                onPress={() => onSelectUser(result.id, result.label)}
                style={styles.searchResultRow}
              >
                <Text style={styles.searchResultText}>{result.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.brand.midGray} />
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.inputLabel}>Prompt</Text>
          <TextInput
            value={prompt}
            onChangeText={onPromptChange}
            placeholder="What should they report back on?"
            placeholderTextColor={Colors.brand.midGray}
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <ToggleRow
            label="A decision is expected after this report"
            value={decisionExpected}
            onValueChange={onDecisionExpectedChange}
          />

          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <AppButton
              label="Send request"
              onPress={onSubmit}
              loading={isSubmitting}
              disabled={!selectedLabel}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SubmitReportSheet({
  visible,
  accomplishmentSummary,
  onAccomplishmentSummaryChange,
  evidenceSummary,
  onEvidenceSummaryChange,
  supportNeeded,
  onSupportNeededChange,
  trainingNeeded,
  onTrainingNeededChange,
  decisionNeeded,
  onDecisionNeededChange,
  recommendedNextStep,
  onRecommendedNextStepChange,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  visible: boolean;
  accomplishmentSummary: string;
  onAccomplishmentSummaryChange: (value: string) => void;
  evidenceSummary: string;
  onEvidenceSummaryChange: (value: string) => void;
  supportNeeded: boolean;
  onSupportNeededChange: (value: boolean) => void;
  trainingNeeded: boolean;
  onTrainingNeededChange: (value: boolean) => void;
  decisionNeeded: boolean;
  onDecisionNeededChange: (value: boolean) => void;
  recommendedNextStep: string;
  onRecommendedNextStepChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Submit report-back</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.brand.midGray} />
            </Pressable>
          </View>
          <Text style={styles.modalSubtitle}>
            Keep this concise and decision-oriented so the next review can move quickly.
          </Text>

          <Text style={styles.inputLabel}>What happened? *</Text>
          <TextInput
            value={accomplishmentSummary}
            onChangeText={onAccomplishmentSummaryChange}
            placeholder="Summarize the outcome or progress"
            placeholderTextColor={Colors.brand.midGray}
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={styles.inputLabel}>Evidence summary</Text>
          <TextInput
            value={evidenceSummary}
            onChangeText={onEvidenceSummaryChange}
            placeholder="What evidence should leaders notice?"
            placeholderTextColor={Colors.brand.midGray}
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <Text style={styles.inputLabel}>Recommended next step</Text>
          <TextInput
            value={recommendedNextStep}
            onChangeText={onRecommendedNextStepChange}
            placeholder="Suggest the next review or action"
            placeholderTextColor={Colors.brand.midGray}
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <ToggleRow label="Support is still needed" value={supportNeeded} onValueChange={onSupportNeededChange} />
          <ToggleRow label="Training is still needed" value={trainingNeeded} onValueChange={onTrainingNeededChange} />
          <ToggleRow label="A new decision is needed" value={decisionNeeded} onValueChange={onDecisionNeededChange} />

          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <AppButton
              label="Submit"
              onPress={onSubmit}
              loading={isSubmitting}
              disabled={!accomplishmentSummary.trim()}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function CarryForwardDetailScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    itemId?: string | string[];
    entityType?: string | string[];
    entityId?: string | string[];
    meetingDate?: string | string[];
    meetingInstanceKey?: string | string[];
    returnTo?: string | string[];
  }>();
  const itemId = Number(getSingleParam(params.itemId) || 0) || null;
  const entityType = getSingleParam(params.entityType) as AgendaEntityType | undefined;
  const entityId = Number(getSingleParam(params.entityId) || 0) || null;
  const meetingDate = getSingleParam(params.meetingDate) || null;
  const routeMeetingInstanceKey = getSingleParam(params.meetingInstanceKey) || null;
  const returnTo = getSingleParam(params.returnTo);
  const detailQuery = useCarryForwardItem(itemId);
  const requestReportMutation = useRequestCarryForwardReport();
  const respondMutation = useRespondToCarryForwardReport();
  const resolveMutation = useResolveCarryForwardItem();
  const dismissMutation = useDismissCarryForwardItem();

  const [requestSheetVisible, setRequestSheetVisible] = useState(false);
  const [requestSearch, setRequestSearch] = useState('');
  const [selectedReporterId, setSelectedReporterId] = useState<number | null>(null);
  const [selectedReporterLabel, setSelectedReporterLabel] = useState<string | null>(null);
  const [requestPrompt, setRequestPrompt] = useState('');
  const [decisionExpected, setDecisionExpected] = useState(false);

  const [submitSheetVisible, setSubmitSheetVisible] = useState(false);
  const [respondRequestId, setRespondRequestId] = useState<number | null>(null);
  const [accomplishmentSummary, setAccomplishmentSummary] = useState('');
  const [evidenceSummary, setEvidenceSummary] = useState('');
  const [supportNeeded, setSupportNeeded] = useState(false);
  const [trainingNeeded, setTrainingNeeded] = useState(false);
  const [decisionNeeded, setDecisionNeeded] = useState(false);
  const [recommendedNextStep, setRecommendedNextStep] = useState('');

  const userSearchQuery = useCarryForwardUserSearch(requestSearch);
  const item = detailQuery.data?.item ?? null;
  const accessDenied = detailQuery.error instanceof ApiResponseError && detailQuery.error.status === 403;
  const safeMeetingInstanceKey = routeMeetingInstanceKey || buildCarryForwardMeetingInstanceKey(entityType, entityId, meetingDate);
  const canDismissOnce = Boolean(item?.can_manage && safeMeetingInstanceKey);
  const myOpenReportRequests = useMemo(
    () => item?.report_requests.filter((request) => request.status === 'open' && request.requested_from_user_id === user?.id) ?? [],
    [item?.report_requests, user?.id],
  );
  const requestResults = userSearchQuery.data?.users.map((entry) => ({ id: entry.id, label: entry.label })) ?? [];
  const tone = statusTone(item?.current_status ?? 'open');

  const resetRequestSheet = () => {
    setRequestSheetVisible(false);
    setRequestSearch('');
    setSelectedReporterId(null);
    setSelectedReporterLabel(null);
    setRequestPrompt('');
    setDecisionExpected(false);
  };

  const resetSubmitSheet = () => {
    setSubmitSheetVisible(false);
    setRespondRequestId(null);
    setAccomplishmentSummary('');
    setEvidenceSummary('');
    setSupportNeeded(false);
    setTrainingNeeded(false);
    setDecisionNeeded(false);
    setRecommendedNextStep('');
  };

  const handleRefresh = async () => {
    triggerGlobalRefreshIndicator();
    await detailQuery.refetch();
  };

  const handleRequestReport = () => {
    if (!item || !selectedReporterId) {
      return;
    }

    requestReportMutation.mutate(
      {
        itemId: item.id,
        requested_from_user_id: selectedReporterId,
        prompt: requestPrompt.trim() || undefined,
        decision_expected: decisionExpected,
      },
      {
        onSuccess: () => {
          resetRequestSheet();
          appAlert('Report-back requested', 'The leader will now see the new report-back request.');
        },
        onError: (error: any) => {
          appAlert('Unable to request report-back', error?.message || 'Please try again.');
        },
      },
    );
  };

  const handleSubmitReport = () => {
    if (!respondRequestId) {
      return;
    }

    respondMutation.mutate(
      {
        reportRequestId: respondRequestId,
        accomplishment_summary: accomplishmentSummary.trim(),
        evidence_summary: evidenceSummary.trim() || undefined,
        support_needed: supportNeeded,
        training_needed: trainingNeeded,
        decision_needed: decisionNeeded,
        recommended_next_step: recommendedNextStep.trim() || undefined,
      },
      {
        onSuccess: () => {
          resetSubmitSheet();
          appAlert('Report-back submitted', 'Your response is now part of the carry-forward thread.');
        },
        onError: (error: any) => {
          appAlert('Unable to submit report-back', error?.message || 'Please try again.');
        },
      },
    );
  };

  const openSubmitSheet = (request: CarryForwardReportRequestSummary) => {
    setRespondRequestId(request.id);
    setSubmitSheetVisible(true);
  };

  const handleResolve = () => {
    if (!item) return;

    appAlert(
      'Resolve this carry-forward item?',
      'Use this when the matter is complete and no longer needs leadership continuity.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: () => {
            resolveMutation.mutate(
              { itemId: item.id },
              {
                onSuccess: () => appAlert('Item resolved', 'This carry-forward thread is now marked resolved.'),
                onError: (error: any) => appAlert('Unable to resolve item', error?.message || 'Please try again.'),
              },
            );
          },
        },
      ],
    );
  };

  const handleDismiss = () => {
    if (!item || !safeMeetingInstanceKey) return;

    appAlert(
      'Dismiss once for this meeting?',
      'This removes the item from this meeting context only. The carry-forward thread itself stays alive.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss once',
          style: 'destructive',
          onPress: () => {
            dismissMutation.mutate(
              {
                itemId: item.id,
                meeting_instance_key: safeMeetingInstanceKey,
              },
              {
                onSuccess: () => {
                  appAlert('Dismissed for this meeting', 'The item has been hidden for this meeting context only.');
                  navigateToReturnTarget(router, '/carry-forward-detail', returnTo);
                },
                onError: (error: any) => {
                  appAlert('Unable to dismiss item', error?.message || 'Please try again.');
                },
              },
            );
          },
        },
      ],
    );
  };

  if (detailQuery.isLoading && !item) {
    return (
      <View style={[styles.container, styles.centered]} testID="carry-forward-detail-screen">
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={styles.loadingText}>Loading carry-forward detail...</Text>
      </View>
    );
  }

  if (accessDenied) {
    return (
      <View style={[styles.container, styles.centered]} testID="carry-forward-detail-blocked">
        <Ionicons name="lock-closed-outline" size={38} color={Colors.brand.error} />
        <Text style={styles.errorTitle}>This carry-forward item is blocked</Text>
        <Text style={styles.errorCopy}>
          You can return safely, but this item is not available with your current permission level.
        </Text>
      </View>
    );
  }

  if (detailQuery.isError || !item) {
    return (
      <View style={[styles.container, styles.centered]} testID="carry-forward-detail-error">
        <Ionicons name="cloud-offline-outline" size={38} color={Colors.brand.error} />
        <Text style={styles.errorTitle}>Unable to load this carry-forward item</Text>
        <Text style={styles.errorCopy}>Pull to refresh and try again.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="carry-forward-detail-screen">
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + WEB_BOTTOM_INSET + 28 }]}
        refreshControl={
          <RefreshControl
            refreshing={detailQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.brand.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          <View style={styles.heroCard}>
            <Text style={styles.eyebrow}>Carry-Forward Detail</Text>
            <Text style={styles.heroTitle}>{item.title}</Text>
            <Text style={styles.heroSubtitle}>{item.purpose_summary}</Text>
            <View style={styles.badgeRow}>
              <AppStatusBadge
                label={item.current_status_label}
                backgroundColor={tone.backgroundColor}
                textColor={tone.textColor}
              />
              {item.support_needed ? <AppStatusBadge label="Support" backgroundColor="#F3E8FF" textColor="#6D28D9" /> : null}
              {item.training_needed ? <AppStatusBadge label="Training" backgroundColor="#F3E8FF" textColor="#6D28D9" /> : null}
              {item.decision_needed ? <AppStatusBadge label="Decision" backgroundColor="#FEF3C7" textColor="#92400E" /> : null}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <DetailRow label="Body" value={item.entity.entity_name} />
            <DetailRow label="Owner" value={item.owner?.name ?? null} />
            <DetailRow label="Next review" value={item.next_review_label} />
            <DetailRow label="Report due" value={item.report_due_label} />
            <DetailRow label="Latest decision" value={item.latest_decision_summary} />
            <DetailRow label="Latest report-back" value={item.latest_report_back_summary} />
          </View>

          {item.latest_report_response ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Latest response</Text>
              <DetailRow label="Submitted by" value={item.latest_report_response.submitted_by?.name ?? null} />
              <DetailRow label="Submitted" value={new Date(item.latest_report_response.submitted_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} />
              <DetailRow label="Accomplishment" value={item.latest_report_response.accomplishment_summary} />
              <DetailRow label="Evidence" value={item.latest_report_response.evidence_summary} />
              <DetailRow label="Recommended next step" value={item.latest_report_response.recommended_next_step} />
            </View>
          ) : null}

          {item.linked_evidence_summary ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Linked evidence</Text>
              <DetailRow label="Summary" value={item.linked_evidence_summary.summary} />
              <DetailRow label="Outcome" value={item.linked_evidence_summary.outcome_text} />
              {item.linked_evidence_summary.goal?.title ? (
                <DetailRow label="Goal" value={item.linked_evidence_summary.goal.title} />
              ) : null}
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Report requests</Text>
            <View style={styles.requestsWrap}>
              {item.report_requests.length === 0 ? (
                <Text style={styles.emptyRequestText}>No report requests have been added yet.</Text>
              ) : (
                item.report_requests.map((request) => {
                  const isMine = request.requested_from_user_id === user?.id;
                  const isOpen = request.status === 'open';

                  return (
                    <View key={request.id} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.requestTitle}>{request.requested_from?.name || 'Requested reporter'}</Text>
                          <Text style={styles.requestMeta}>
                            {request.due_label ? `Due ${request.due_label}` : 'No due date'}
                            {request.decision_expected ? ' · Decision expected' : ''}
                          </Text>
                        </View>
                        <AppStatusBadge
                          label={request.status === 'open' ? 'Open' : 'Complete'}
                          backgroundColor={isOpen ? '#FEF3C7' : '#D1FAE5'}
                          textColor={isOpen ? '#92400E' : '#065F46'}
                        />
                      </View>
                      {request.prompt ? <Text style={styles.requestPrompt}>{request.prompt}</Text> : null}
                      {request.latest_response_summary ? (
                        <Text style={styles.requestResponse} numberOfLines={2}>
                          Latest response: {request.latest_response_summary}
                        </Text>
                      ) : null}
                      {isMine && isOpen ? (
                        <AppButton
                          label="Submit report-back"
                          onPress={() => openSubmitSheet(request)}
                          style={{ marginTop: 12 }}
                          testID={`carry-forward-submit-report-${request.id}`}
                        />
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {(item.can_manage || myOpenReportRequests.length > 0) ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Actions</Text>
              <View style={styles.actionStack}>
                {item.can_manage ? (
                  <AppButton
                    label="Request report-back"
                    variant="secondary"
                    onPress={() => setRequestSheetVisible(true)}
                    testID="carry-forward-request-report-btn"
                  />
                ) : null}
                {item.can_manage ? (
                  <AppButton
                    label="Resolve"
                    onPress={handleResolve}
                    loading={resolveMutation.isPending}
                    testID="carry-forward-resolve-btn"
                  />
                ) : null}
                {canDismissOnce ? (
                  <AppButton
                    label="Dismiss once"
                    variant="danger"
                    onPress={handleDismiss}
                    loading={dismissMutation.isPending}
                    testID="carry-forward-dismiss-btn"
                  />
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <RequestReportSheet
        visible={requestSheetVisible}
        query={requestSearch}
        onQueryChange={setRequestSearch}
        selectedLabel={selectedReporterLabel}
        results={requestResults}
        isSearching={userSearchQuery.isFetching}
        prompt={requestPrompt}
        onPromptChange={setRequestPrompt}
        decisionExpected={decisionExpected}
        onDecisionExpectedChange={setDecisionExpected}
        onSelectUser={(id, label) => {
          setSelectedReporterId(id);
          setSelectedReporterLabel(label);
        }}
        onClose={resetRequestSheet}
        onSubmit={handleRequestReport}
        isSubmitting={requestReportMutation.isPending}
      />

      <SubmitReportSheet
        visible={submitSheetVisible}
        accomplishmentSummary={accomplishmentSummary}
        onAccomplishmentSummaryChange={setAccomplishmentSummary}
        evidenceSummary={evidenceSummary}
        onEvidenceSummaryChange={setEvidenceSummary}
        supportNeeded={supportNeeded}
        onSupportNeededChange={setSupportNeeded}
        trainingNeeded={trainingNeeded}
        onTrainingNeededChange={setTrainingNeeded}
        decisionNeeded={decisionNeeded}
        onDecisionNeededChange={setDecisionNeeded}
        recommendedNextStep={recommendedNextStep}
        onRecommendedNextStepChange={setRecommendedNextStep}
        onClose={resetSubmitSheet}
        onSubmit={handleSubmitReport}
        isSubmitting={respondMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  errorTitle: {
    marginTop: 14,
    fontSize: 18,
    color: Colors.brand.dark,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  errorCopy: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.midGray,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  scrollContent: {
    paddingTop: 12,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: 18,
    gap: 14,
  },
  heroCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 20,
    padding: 18,
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 3, 10),
    elevation: 3,
  },
  eyebrow: {
    fontSize: 12,
    color: Colors.brand.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Inter_700Bold',
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 22,
    color: Colors.brand.black,
    fontFamily: 'Inter_700Bold',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  badgeRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sectionCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 18,
    padding: 18,
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 3, 10),
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 17,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  detailRow: {
    marginTop: 12,
    gap: 3,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.brand.midGray,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: 'Inter_700Bold',
  },
  detailValue: {
    fontSize: 15,
    lineHeight: 21,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
  },
  requestsWrap: {
    marginTop: 12,
    gap: 12,
  },
  emptyRequestText: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  requestCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    padding: 14,
    gap: 8,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  requestTitle: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  requestMeta: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  requestPrompt: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  requestResponse: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  actionStack: {
    marginTop: 14,
    gap: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  modalSheet: {
    maxHeight: '88%',
    backgroundColor: Colors.brand.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 10,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.brand.lightGray,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  inputLabel: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_600SemiBold',
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    backgroundColor: Colors.brand.inputBg,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
  },
  textArea: {
    minHeight: 96,
    paddingTop: 12,
  },
  selectedChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E8F8F0',
  },
  selectedChipText: {
    fontSize: 13,
    color: '#0F766E',
    fontFamily: 'Inter_600SemiBold',
  },
  searchResults: {
    maxHeight: 180,
  },
  searchResultRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.brand.inputBorder,
    paddingVertical: 10,
  },
  searchResultText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
  },
  inlineState: {
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
  },
  inlineStateText: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  emptySearchText: {
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.brand.midGray,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  toggleRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelButton: {
    minWidth: 96,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    fontSize: 14,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_600SemiBold',
  },
});
