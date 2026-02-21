import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import Colors from '@/constants/colors';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#f3f4f6', text: '#6b7280' },
  submitted: { bg: '#e0e7ff', text: '#3730a3' },
  discussion: { bg: '#dbeafe', text: '#1e40af' },
  voting: { bg: '#fef3c7', text: '#92400e' },
  approved: { bg: '#d1fae5', text: '#065f46' },
  not_approved: { bg: '#fce7f3', text: '#9d174d' },
  in_progress: { bg: '#dbeafe', text: '#1e40af' },
  completed: { bg: '#d1fae5', text: '#065f46' },
  cancelled: { bg: '#f3f4f6', text: '#6b7280' },
};

function ActionButton({ label, icon, onPress, variant = 'primary', loading = false }: {
  label: string; icon: string; onPress: () => void; variant?: 'primary' | 'danger' | 'outline';
  loading?: boolean;
}) {
  const bg = variant === 'primary' ? Colors.brand.primary : variant === 'danger' ? Colors.brand.error : Colors.brand.white;
  const textColor = variant === 'outline' ? Colors.brand.primary : Colors.brand.white;
  return (
    <Pressable
      onPress={onPress}
      style={[abStyles.btn, { backgroundColor: bg }, variant === 'outline' && abStyles.outline]}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          <Ionicons name={icon as any} size={16} color={textColor} />
          <Text style={[abStyles.text, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const abStyles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, marginRight: 8, marginBottom: 8 },
  outline: { borderWidth: 1, borderColor: Colors.brand.primary },
  text: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
});

function TimelineView({ timeline }: { timeline: any[] }) {
  return (
    <View style={tlStyles.container}>
      <Text style={tlStyles.title}>Status Timeline</Text>
      {timeline.map((phase, idx) => (
        <View key={phase.phase} style={tlStyles.row}>
          <View style={tlStyles.dotCol}>
            <View style={[
              tlStyles.dot,
              phase.active && tlStyles.dotActive,
              phase.reached && !phase.active && tlStyles.dotReached,
            ]} />
            {idx < timeline.length - 1 && (
              <View style={[tlStyles.line, phase.reached && tlStyles.lineReached]} />
            )}
          </View>
          <View style={tlStyles.labelCol}>
            <Text style={[tlStyles.label, phase.active && tlStyles.labelActive]}>
              {phase.label}
            </Text>
            {phase.date && <Text style={tlStyles.date}>{new Date(phase.date).toLocaleDateString()}</Text>}
            {phase.active && <Text style={tlStyles.currentBadge}>Current</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

const tlStyles = StyleSheet.create({
  container: { backgroundColor: Colors.brand.white, borderRadius: 14, padding: 16, marginBottom: 14, shadowColor: 'rgba(15, 23, 42, 0.1)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3 },
  title: { fontSize: 15, fontWeight: '700' as const, color: Colors.brand.dark, marginBottom: 16, fontFamily: 'Inter_700Bold', borderLeftWidth: 3, borderLeftColor: Colors.brand.primary, paddingLeft: 10 },
  row: { flexDirection: 'row', minHeight: 40 },
  dotCol: { alignItems: 'center', width: 24, marginRight: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: Colors.brand.lightGray, backgroundColor: Colors.brand.white },
  dotActive: { borderColor: Colors.brand.primary, backgroundColor: Colors.brand.primary },
  dotReached: { borderColor: Colors.brand.success, backgroundColor: Colors.brand.success },
  line: { flex: 1, width: 2, backgroundColor: Colors.brand.lightGray, marginVertical: 2 },
  lineReached: { backgroundColor: Colors.brand.success },
  labelCol: { flex: 1, paddingBottom: 12 },
  label: { fontSize: 14, color: Colors.brand.dark, fontFamily: 'Inter_400Regular' },
  labelActive: { fontFamily: 'Inter_700Bold', color: Colors.brand.primary },
  date: { fontSize: 11, color: Colors.brand.midGray, marginTop: 2, fontFamily: 'Inter_400Regular' },
  currentBadge: { fontSize: 10, color: Colors.brand.primary, fontWeight: '600' as const, marginTop: 2, fontFamily: 'Inter_600SemiBold' },
});

function StepsSection({ steps, canManage, requestId, token, onRefresh, sundayBusinessGate }: {
  steps: any[]; canManage: boolean; requestId: number; token: string | null; onRefresh: () => void;
  sundayBusinessGate: { active: boolean; total_items: number; completed_items: number; message: string } | null;
}) {
  const [updatingStep, setUpdatingStep] = useState<number | null>(null);
  const completed = steps.filter(s => s.status === 'completed').length;
  const total = steps.filter(s => s.status !== 'skipped').length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  const firstGatedIndex = steps.findIndex(s => s.is_gated);

  const updateStep = async (stepId: number, newStatus: string) => {
    setUpdatingStep(stepId);
    try {
      await authFetch(token, `/api/calling-requests/${requestId}/steps/${stepId}`, {
        method: 'PATCH',
        body: { status: newStatus },
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRefresh();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update step.');
    } finally {
      setUpdatingStep(null);
    }
  };

  const stepIcon = (status: string, isGated: boolean) => {
    if (isGated) return <Ionicons name="lock-closed" size={20} color={Colors.brand.midGray} />;
    switch (status) {
      case 'completed': return <Ionicons name="checkmark-circle" size={20} color={Colors.brand.success} />;
      case 'in_progress': return <MaterialCommunityIcons name="progress-clock" size={20} color={Colors.brand.warning} />;
      case 'skipped': return <Ionicons name="remove-circle-outline" size={20} color={Colors.brand.midGray} />;
      default: return <Ionicons name="ellipse-outline" size={20} color={Colors.brand.lightGray} />;
    }
  };

  return (
    <View>
      <View style={ssStyles.progressRow}>
        <View style={ssStyles.progressTrack}>
          <View style={[ssStyles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={ssStyles.progressText}>{completed}/{total}</Text>
      </View>
      {steps.map((step, idx) => (
        <React.Fragment key={step.id}>
          {sundayBusinessGate?.active && idx === firstGatedIndex && firstGatedIndex >= 0 && (
            <Pressable
              onPress={() => router.push('/sunday-business')}
              style={ssStyles.gateBanner}
            >
              <Ionicons name="time-outline" size={18} color="#155E75" />
              <View style={ssStyles.gateBannerContent}>
                <Text style={ssStyles.gateBannerText}>{sundayBusinessGate.message}</Text>
                <View style={ssStyles.gateLinkRow}>
                  <Text style={ssStyles.gateLinkText}>View Sunday Business</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.brand.primary} />
                </View>
              </View>
            </Pressable>
          )}
          <View style={[ssStyles.stepRow, step.is_gated && ssStyles.stepRowGated]}>
            {stepIcon(step.status, step.is_gated)}
            <View style={ssStyles.stepInfo}>
              <Text style={[ssStyles.stepLabel, step.status === 'skipped' && ssStyles.stepSkipped, step.is_gated && ssStyles.stepLabelGated]}>
                {step.step_type_label || step.step_type}
              </Text>
              {step.is_gated && <Text style={ssStyles.stepGatedMeta}>Blocked</Text>}
              {!step.is_gated && step.assigned_to && <Text style={ssStyles.stepMeta}>{step.assigned_to.name}</Text>}
              {!step.is_gated && step.scheduled_date && <Text style={ssStyles.stepMeta}>{new Date(step.scheduled_date).toLocaleDateString()}</Text>}
            </View>
            {canManage && !step.is_gated && step.status === 'pending' && (
              <Pressable
                onPress={() => updateStep(step.id, 'completed')}
                style={ssStyles.completeBtn}
                disabled={updatingStep === step.id}
              >
                {updatingStep === step.id ? (
                  <ActivityIndicator size="small" color={Colors.brand.primary} />
                ) : (
                  <Ionicons name="checkmark" size={18} color={Colors.brand.primary} />
                )}
              </Pressable>
            )}
            {canManage && !step.is_gated && step.status === 'in_progress' && (
              <Pressable
                onPress={() => updateStep(step.id, 'completed')}
                style={ssStyles.completeBtn}
                disabled={updatingStep === step.id}
              >
                {updatingStep === step.id ? (
                  <ActivityIndicator size="small" color={Colors.brand.success} />
                ) : (
                  <Ionicons name="checkmark-done" size={18} color={Colors.brand.success} />
                )}
              </Pressable>
            )}
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const ssStyles = StyleSheet.create({
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  progressTrack: { flex: 1, height: 6, backgroundColor: Colors.brand.lightGray, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.brand.success, borderRadius: 3 },
  progressText: { fontSize: 12, color: Colors.brand.darkGray, fontFamily: 'Inter_600SemiBold', width: 32 },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.brand.lightGray, gap: 10 },
  stepInfo: { flex: 1 },
  stepLabel: { fontSize: 14, color: Colors.brand.dark, fontFamily: 'Inter_500Medium' },
  stepSkipped: { color: Colors.brand.midGray, textDecorationLine: 'line-through' as const },
  stepMeta: { fontSize: 12, color: Colors.brand.midGray, marginTop: 2, fontFamily: 'Inter_400Regular' },
  stepRowGated: { opacity: 0.5 },
  stepLabelGated: { color: Colors.brand.midGray },
  stepGatedMeta: { fontSize: 11, color: Colors.brand.midGray, marginTop: 2, fontFamily: 'Inter_500Medium', fontStyle: 'italic' as const },
  completeBtn: { padding: 6 },
  gateBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#E0F7FA',
    borderRadius: 10, padding: 14, marginVertical: 8, borderLeftWidth: 3, borderLeftColor: '#0891B2',
  },
  gateBannerContent: { flex: 1 },
  gateBannerText: { fontSize: 13, color: '#155E75', fontFamily: 'Inter_500Medium', lineHeight: 18 },
  gateLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  gateLinkText: { fontSize: 13, color: Colors.brand.primary, fontFamily: 'Inter_600SemiBold' },
});

function VotingSection({ detail, permissions, requestId, token, userId, onRefresh }: {
  detail: any; permissions: any; requestId: number; token: string | null; userId: number; onRefresh: () => void;
}) {
  const [vote, setVote] = useState<'approve' | 'disapprove' | ''>('');
  const [nomineeId, setNomineeId] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingVotersExpanded, setPendingVotersExpanded] = useState(false);

  const tally = detail.vote_tally || { approve: 0, disapprove: 0, total_voters: 0 };
  const votes = detail.votes || [];
  const individuals = detail.individuals || [];
  const castCount = tally.approve + tally.disapprove;
  const pendingCount = Math.max(0, tally.total_voters - castCount);
  const participationPct = tally.total_voters > 0 ? Math.round((castCount / tally.total_voters) * 100) : 0;
  const myVote = votes.find((v: any) => v.voter?.id === userId);
  const canSeePending = permissions.can_decide || permissions.can_manage;
  const pendingVoters = detail.pending_voters || [];

  const submitVote = async () => {
    if (!vote) { Alert.alert('Required', 'Please select your recommendation.'); return; }
    if (individuals.length > 1 && !nomineeId) { Alert.alert('Required', 'Please select which individual.'); return; }
    setSubmitting(true);
    try {
      await authFetch(token, `/api/calling-requests/${requestId}/vote`, {
        method: 'POST',
        body: { vote, nominee_id: nomineeId || individuals[0]?.id, comment: comment.trim() || null, is_private: isPrivate },
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRefresh();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <View style={vsStyles.participationSection}>
        <View style={vsStyles.participationHeader}>
          <Text style={vsStyles.participationTitle}>Participation</Text>
          <Text style={vsStyles.participationPct}>{participationPct}%</Text>
        </View>
        <View style={vsStyles.participationTrack}>
          <View style={[vsStyles.participationFillApprove, { width: `${tally.total_voters > 0 ? (tally.approve / tally.total_voters) * 100 : 0}%` }]} />
          <View style={[vsStyles.participationFillDisapprove, { width: `${tally.total_voters > 0 ? (tally.disapprove / tally.total_voters) * 100 : 0}%` }]} />
        </View>
        <View style={vsStyles.participationLegend}>
          <View style={vsStyles.legendItem}>
            <View style={[vsStyles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={vsStyles.legendText}>{tally.approve} Approve</Text>
          </View>
          <View style={vsStyles.legendItem}>
            <View style={[vsStyles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={vsStyles.legendText}>{tally.disapprove} Oppose</Text>
          </View>
          <View style={vsStyles.legendItem}>
            <View style={[vsStyles.legendDot, { backgroundColor: '#D1D5DB' }]} />
            <Text style={vsStyles.legendText}>{pendingCount} Pending</Text>
          </View>
        </View>
      </View>

      {myVote && (
        <View style={vsStyles.yourVoteCard}>
          <View style={vsStyles.yourVoteHeader}>
            <Ionicons
              name={myVote.vote === 'approve' ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={myVote.vote === 'approve' ? '#10B981' : '#EF4444'}
            />
            <Text style={vsStyles.yourVoteTitle}>You voted</Text>
          </View>
          <Text style={vsStyles.yourVoteValue}>
            {myVote.vote === 'approve' ? 'Approve' : 'Not Approved'}
            {myVote.individual ? ` \u2014 ${myVote.individual.name}` : ''}
          </Text>
          {myVote.comment && <Text style={vsStyles.yourVoteComment}>{myVote.comment}</Text>}
        </View>
      )}

      {votes.length > 0 && (
        <View style={vsStyles.votesList}>
          <Text style={vsStyles.votesListTitle}>All Recommendations</Text>
          {votes.map((v: any) => (
            <View key={v.id} style={vsStyles.voteItem}>
              <View style={[vsStyles.voteBadge, { backgroundColor: v.vote === 'approve' ? '#d1fae5' : '#fce7f3' }]}>
                <Ionicons
                  name={v.vote === 'approve' ? 'checkmark' : 'close'}
                  size={14}
                  color={v.vote === 'approve' ? '#065f46' : '#9d174d'}
                />
              </View>
              <View style={vsStyles.voteInfo}>
                <Text style={vsStyles.voterName}>{v.voter?.name || 'Member'}</Text>
                {v.individual && <Text style={vsStyles.voteFor}>for {v.individual.name}</Text>}
                {v.comment !== null ? (
                  <Text style={vsStyles.voteComment}>{v.comment}</Text>
                ) : v.is_private ? (
                  <Text style={vsStyles.privateComment}>Private comment \u2014 Stake President only</Text>
                ) : null}
              </View>
              {v.is_private && v.comment !== null && (
                <View style={vsStyles.privateBadge}>
                  <Text style={vsStyles.privateBadgeText}>Private</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {canSeePending && pendingCount > 0 && (
        <View style={vsStyles.pendingSection}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              setPendingVotersExpanded(!pendingVotersExpanded);
            }}
            style={vsStyles.pendingHeader}
          >
            <Ionicons name="people-outline" size={18} color="#B45309" />
            <Text style={vsStyles.pendingTitle}>Pending Voters ({pendingCount})</Text>
            <Ionicons name={pendingVotersExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.brand.midGray} />
          </Pressable>
          {pendingVotersExpanded && pendingVoters.length > 0 && (
            <View style={vsStyles.pendingList}>
              {pendingVoters.map((pv: any, idx: number) => (
                <View key={pv.id || idx} style={vsStyles.pendingVoterRow}>
                  <Ionicons name="ellipse-outline" size={14} color={Colors.brand.midGray} />
                  <Text style={vsStyles.pendingVoterName}>{pv.name || pv.voter_name || 'Member'}</Text>
                </View>
              ))}
            </View>
          )}
          {pendingVotersExpanded && pendingVoters.length === 0 && pendingCount > 0 && (
            <Text style={vsStyles.pendingNoData}>{pendingCount} voter(s) have not yet submitted their recommendation.</Text>
          )}
        </View>
      )}

      {permissions.can_vote && !myVote && (
        <View style={vsStyles.formSection}>
          <Text style={vsStyles.formTitle}>Cast Your Vote</Text>
          {individuals.length > 1 && (
            <View style={vsStyles.radioGroup}>
              <Text style={vsStyles.radioLabel}>Which individual do you feel inspired to support?</Text>
              {individuals.map((ind: any) => (
                <Pressable key={ind.id} onPress={() => setNomineeId(ind.id)} style={vsStyles.radioRow}>
                  <Ionicons name={nomineeId === ind.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={Colors.brand.primary} />
                  <Text style={vsStyles.radioText}>{ind.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={vsStyles.radioGroup}>
            <Pressable onPress={() => setVote('approve')} style={[vsStyles.voteOptionCard, vote === 'approve' && vsStyles.voteOptionCardApprove]}>
              <Ionicons name={vote === 'approve' ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={vote === 'approve' ? '#10B981' : Colors.brand.midGray} />
              <Text style={[vsStyles.voteOptionText, vote === 'approve' && { color: '#065f46', fontFamily: 'Inter_600SemiBold' }]}>Approve</Text>
            </Pressable>
            <Pressable onPress={() => setVote('disapprove')} style={[vsStyles.voteOptionCard, vote === 'disapprove' && vsStyles.voteOptionCardDisapprove]}>
              <Ionicons name={vote === 'disapprove' ? 'close-circle' : 'ellipse-outline'} size={22} color={vote === 'disapprove' ? '#EF4444' : Colors.brand.midGray} />
              <Text style={[vsStyles.voteOptionText, vote === 'disapprove' && { color: '#991B1B', fontFamily: 'Inter_600SemiBold' }]}>Not Approved</Text>
            </Pressable>
          </View>
          <TextInput
            style={vsStyles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment (optional)..."
            placeholderTextColor={Colors.brand.midGray}
            multiline
          />
          <Pressable onPress={() => setIsPrivate(!isPrivate)} style={vsStyles.checkRow}>
            <Ionicons name={isPrivate ? 'checkbox' : 'square-outline'} size={20} color={Colors.brand.primary} />
            <Text style={vsStyles.checkText}>Private comment (visible to Stake President only)</Text>
          </Pressable>
          <Pressable onPress={submitVote} style={[vsStyles.submitBtn, !vote && { opacity: 0.5 }]} disabled={submitting || !vote}>
            {submitting ? <ActivityIndicator size="small" color={Colors.brand.white} /> : (
              <Text style={vsStyles.submitBtnText}>Submit Recommendation</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const vsStyles = StyleSheet.create({
  participationSection: { marginBottom: 16 },
  participationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  participationTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.dark, fontFamily: 'Inter_600SemiBold' },
  participationPct: { fontSize: 14, fontWeight: '700' as const, color: Colors.brand.primary, fontFamily: 'Inter_700Bold' },
  participationTrack: { height: 10, backgroundColor: '#E5E7EB', borderRadius: 5, overflow: 'hidden', flexDirection: 'row' },
  participationFillApprove: { height: '100%', backgroundColor: '#10B981' },
  participationFillDisapprove: { height: '100%', backgroundColor: '#EF4444' },
  participationLegend: { flexDirection: 'row', gap: 14, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: Colors.brand.darkGray, fontFamily: 'Inter_400Regular' },
  yourVoteCard: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#BBF7D0' },
  yourVoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  yourVoteTitle: { fontSize: 14, fontWeight: '600' as const, color: '#065f46', fontFamily: 'Inter_600SemiBold' },
  yourVoteValue: { fontSize: 15, fontWeight: '700' as const, color: Colors.brand.dark, fontFamily: 'Inter_700Bold', marginLeft: 26 },
  yourVoteComment: { fontSize: 13, color: Colors.brand.darkGray, marginTop: 4, marginLeft: 26, fontFamily: 'Inter_400Regular' },
  votesList: { marginBottom: 14 },
  votesListTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.dark, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  voteItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.brand.lightGray, gap: 10 },
  voteBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  voteInfo: { flex: 1 },
  voterName: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.dark, fontFamily: 'Inter_600SemiBold' },
  voteFor: { fontSize: 12, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },
  voteComment: { fontSize: 13, color: Colors.brand.darkGray, marginTop: 4, fontFamily: 'Inter_400Regular' },
  privateComment: { fontSize: 12, color: Colors.brand.midGray, fontStyle: 'italic' as const, marginTop: 4, fontFamily: 'Inter_400Regular' },
  privateBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  privateBadgeText: { fontSize: 10, color: '#92400e', fontFamily: 'Inter_600SemiBold' },
  pendingSection: { backgroundColor: '#FFFBEB', borderRadius: 12, marginBottom: 14, overflow: 'hidden' },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  pendingTitle: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: '#B45309', fontFamily: 'Inter_600SemiBold' },
  pendingList: { paddingHorizontal: 14, paddingBottom: 14 },
  pendingVoterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  pendingVoterName: { fontSize: 14, color: Colors.brand.dark, fontFamily: 'Inter_400Regular' },
  pendingNoData: { fontSize: 13, color: '#B45309', paddingHorizontal: 14, paddingBottom: 14, fontFamily: 'Inter_400Regular' },
  formSection: { backgroundColor: Colors.brand.sectionBg, borderRadius: 14, padding: 16, marginTop: 8 },
  formTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.brand.dark, marginBottom: 14, fontFamily: 'Inter_700Bold', borderLeftWidth: 3, borderLeftColor: Colors.brand.primary, paddingLeft: 10 },
  radioGroup: { marginBottom: 12, gap: 8 },
  radioLabel: { fontSize: 13, color: Colors.brand.darkGray, marginBottom: 8, fontFamily: 'Inter_500Medium' },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  radioText: { fontSize: 14, color: Colors.brand.dark, fontFamily: 'Inter_400Regular' },
  voteOptionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.brand.white,
    borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: Colors.brand.lightGray,
  },
  voteOptionCardApprove: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  voteOptionCardDisapprove: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  voteOptionText: { fontSize: 15, color: Colors.brand.dark, fontFamily: 'Inter_500Medium' },
  commentInput: {
    backgroundColor: Colors.brand.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.brand.inputBorder,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.brand.dark, fontFamily: 'Inter_400Regular',
    minHeight: 60, marginBottom: 10,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  checkText: { fontSize: 13, color: Colors.brand.darkGray, fontFamily: 'Inter_400Regular', flex: 1 },
  submitBtn: { backgroundColor: Colors.brand.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.white, fontFamily: 'Inter_600SemiBold' },
});

function DiscussionSection({ detail, permissions, requestId, token, onRefresh }: {
  detail: any; permissions: any; requestId: number; token: string | null; onRefresh: () => void;
}) {
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [decideVote, setDecideVote] = useState<'approved' | 'not_approved' | ''>('');
  const [decideFeedback, setDecideFeedback] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const comments = (detail.comments || []).filter((c: any) => c.phase !== 'presidency_recommendation');
  const feedbackRequests = detail.feedback_requests || [];

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await authFetch(token, `/api/calling-requests/${requestId}/comments`, {
        method: 'POST',
        body: { comment: commentText.trim() },
      });
      setCommentText('');
      onRefresh();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const submitDecision = async () => {
    if (!decideVote) { Alert.alert('Required', 'Please select a decision.'); return; }
    setSubmittingDecision(true);
    try {
      await authFetch(token, `/api/calling-requests/${requestId}/decide`, {
        method: 'POST',
        body: { decision: decideVote, feedback: decideFeedback.trim() || null },
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRefresh();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmittingDecision(false);
    }
  };

  return (
    <View>
      {feedbackRequests.length > 0 && (
        <View style={dsStyles.fbSection}>
          <Text style={dsStyles.subTitle}>Confidential Feedback</Text>
          {feedbackRequests.map((fb: any) => (
            <View key={fb.id} style={dsStyles.fbCard}>
              <View style={dsStyles.fbHeader}>
                <Text style={dsStyles.fbFrom}>From: {fb.requested_of?.name || 'Leader'}</Text>
                {fb.is_pending && <View style={dsStyles.pendingDot} />}
              </View>
              {fb.response ? (
                <Text style={dsStyles.fbResponse}>{fb.response}</Text>
              ) : fb.is_pending ? (
                <Text style={dsStyles.fbPending}>Awaiting response</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {comments.length > 0 && (
        <View style={dsStyles.commentsSection}>
          <Text style={dsStyles.subTitle}>Discussion</Text>
          {comments.map((c: any) => (
            <View key={c.id} style={dsStyles.commentCard}>
              <Text style={dsStyles.commentAuthor}>{c.author?.name || 'System'}</Text>
              <Text style={dsStyles.commentText}>{c.comment}</Text>
              <Text style={dsStyles.commentDate}>{new Date(c.created_at).toLocaleDateString()}</Text>
            </View>
          ))}
        </View>
      )}

      {permissions.can_comment && (
        <View style={dsStyles.addComment}>
          <TextInput
            style={dsStyles.commentInput}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Add a comment..."
            placeholderTextColor={Colors.brand.midGray}
            multiline
          />
          <Pressable onPress={submitComment} style={dsStyles.commentSubmitBtn} disabled={submittingComment}>
            {submittingComment ? (
              <ActivityIndicator size="small" color={Colors.brand.white} />
            ) : (
              <Ionicons name="send" size={16} color={Colors.brand.white} />
            )}
          </Pressable>
        </View>
      )}

      {permissions.can_decide && (
        <View style={dsStyles.decisionSection}>
          <Text style={dsStyles.subTitle}>Record Decision</Text>
          <View style={dsStyles.radioGroup}>
            <Pressable onPress={() => setDecideVote('approved')} style={dsStyles.radioRow}>
              <Ionicons name={decideVote === 'approved' ? 'radio-button-on' : 'radio-button-off'} size={20} color={Colors.brand.success} />
              <Text style={dsStyles.radioText}>Approved</Text>
            </Pressable>
            <Pressable onPress={() => setDecideVote('not_approved')} style={dsStyles.radioRow}>
              <Ionicons name={decideVote === 'not_approved' ? 'radio-button-on' : 'radio-button-off'} size={20} color={Colors.brand.error} />
              <Text style={dsStyles.radioText}>Not Approved</Text>
            </Pressable>
          </View>
          <TextInput
            style={dsStyles.commentInput}
            value={decideFeedback}
            onChangeText={setDecideFeedback}
            placeholder="Feedback (optional)"
            placeholderTextColor={Colors.brand.midGray}
            multiline
          />
          <Pressable onPress={submitDecision} style={dsStyles.decisionBtn} disabled={submittingDecision}>
            {submittingDecision ? (
              <ActivityIndicator size="small" color={Colors.brand.white} />
            ) : (
              <Text style={dsStyles.decisionBtnText}>Record Decision</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const dsStyles = StyleSheet.create({
  fbSection: { marginBottom: 16 },
  subTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.brand.dark, marginBottom: 10, fontFamily: 'Inter_700Bold', borderLeftWidth: 3, borderLeftColor: Colors.brand.primary, paddingLeft: 10 },
  fbCard: { backgroundColor: Colors.brand.sectionBg, borderRadius: 12, padding: 12, marginBottom: 8 },
  fbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  fbFrom: { fontSize: 13, fontWeight: '600' as const, color: Colors.brand.dark, fontFamily: 'Inter_600SemiBold' },
  pendingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.brand.warning },
  fbResponse: { fontSize: 13, color: Colors.brand.darkGray, fontFamily: 'Inter_400Regular' },
  fbPending: { fontSize: 12, color: Colors.brand.midGray, fontStyle: 'italic' as const, fontFamily: 'Inter_400Regular' },
  commentsSection: { marginBottom: 16 },
  commentCard: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.brand.lightGray },
  commentAuthor: { fontSize: 13, fontWeight: '600' as const, color: Colors.brand.dark, fontFamily: 'Inter_600SemiBold' },
  commentText: { fontSize: 14, color: Colors.brand.darkGray, marginTop: 4, fontFamily: 'Inter_400Regular' },
  commentDate: { fontSize: 11, color: Colors.brand.midGray, marginTop: 4, fontFamily: 'Inter_400Regular' },
  addComment: { flexDirection: 'row', gap: 8, marginBottom: 16, alignItems: 'flex-end' },
  commentInput: {
    flex: 1, backgroundColor: Colors.brand.inputBg, borderRadius: 12, borderWidth: 1, borderColor: Colors.brand.inputBorder,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.brand.dark, fontFamily: 'Inter_400Regular',
    minHeight: 44,
  },
  commentSubmitBtn: { backgroundColor: Colors.brand.primary, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  decisionSection: { backgroundColor: Colors.brand.sectionBg, borderRadius: 14, padding: 16, marginTop: 8 },
  radioGroup: { marginBottom: 12 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  radioText: { fontSize: 14, color: Colors.brand.dark, fontFamily: 'Inter_400Regular' },
  decisionBtn: { backgroundColor: Colors.brand.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  decisionBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.white, fontFamily: 'Inter_600SemiBold' },
});

function NextActionBanner({ nextAction, onActionPress }: {
  nextAction: { type: string; heading: string; description: string; context: string | null; style: string; is_terminal: boolean; is_waiting: boolean };
  onActionPress: (type: string) => void;
}) {
  const STYLE_COLORS: Record<string, { bg: string; accent: string; text: string }> = {
    primary: { bg: '#E8F4F8', accent: '#016183', text: '#016183' },
    success: { bg: '#d1fae5', accent: '#10B981', text: '#065f46' },
    warning: { bg: '#fef3c7', accent: '#F59E0B', text: '#92400e' },
    info: { bg: '#E0F7FA', accent: '#0891B2', text: '#155E75' },
    muted: { bg: '#f3f4f6', accent: '#94A3B8', text: '#6b7280' },
    danger: { bg: '#FEF2F2', accent: '#EF4444', text: '#991B1B' },
  };
  const colors = STYLE_COLORS[nextAction.style] || STYLE_COLORS.primary;

  const icon = nextAction.is_terminal
    ? (nextAction.type === 'completed' ? 'checkmark-circle' : nextAction.type === 'cancelled' ? 'close-circle' : 'alert-circle')
    : nextAction.is_waiting ? 'time-outline' : 'arrow-forward-circle';

  const ACTION_HINTS: Record<string, string> = {
    vote: 'Cast Recommendation',
    voted: '',
    submit: 'Submit for Review',
    begin_review: 'Begin Review',
    decide: 'Record Decision',
    decide_or_vote: 'Take Action',
    decide_after_voting: 'Record Decision',
    provide_recommendation: 'Provide Recommendation',
    respond_feedback: 'Respond to Feedback',
    select_nominee: 'Select Individual',
    assign_interviewer: 'Assign Interviewer',
    next_step: 'Update Step',
    mark_complete: 'Mark Complete',
  };
  const hintLabel = ACTION_HINTS[nextAction.type] || '';
  const showHint = !nextAction.is_terminal && !nextAction.is_waiting && !!hintLabel;
  const showSundayBusinessLink = nextAction.type === 'waiting_sunday_business';

  return (
    <Animated.View entering={FadeInDown.duration(300).delay(80)} style={[naBannerStyles.container, { backgroundColor: colors.bg, borderLeftColor: colors.accent }]}>
      <View style={naBannerStyles.headerRow}>
        <Ionicons name={icon as any} size={20} color={colors.accent} />
        <Text style={[naBannerStyles.heading, { color: colors.text }]}>{nextAction.heading}</Text>
      </View>
      <Text style={[naBannerStyles.description, { color: colors.text }]}>{nextAction.description}</Text>
      {nextAction.context && (
        <Text style={[naBannerStyles.context, { color: colors.text }]}>{nextAction.context}</Text>
      )}
      {showHint && (
        <View style={[naBannerStyles.hintRow, { backgroundColor: colors.accent + '15' }]}>
          <Ionicons name="hand-right-outline" size={14} color={colors.accent} />
          <Text style={[naBannerStyles.hintText, { color: colors.accent }]}>{hintLabel} below</Text>
        </View>
      )}
      {showSundayBusinessLink && (
        <Pressable onPress={() => router.push('/sunday-business')} style={naBannerStyles.linkRow}>
          <Text style={[naBannerStyles.linkText, { color: colors.accent }]}>View Sunday Business</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.accent} />
        </Pressable>
      )}
    </Animated.View>
  );
}

const naBannerStyles = StyleSheet.create({
  container: { marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 16, borderLeftWidth: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  heading: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  description: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  context: { fontSize: 13, fontFamily: 'Inter_500Medium', opacity: 0.8, marginBottom: 4 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginTop: 8, alignSelf: 'flex-start' as const },
  hintText: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  linkText: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
});

export default function CallingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const qClient = useQueryClient();
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;
  const requestId = Number(id);

  const [activeTab, setActiveTab] = useState<'discussion' | 'approvals' | 'steps'>('discussion');
  const [actionLoading, setActionLoading] = useState('');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<{
    calling_request: any;
    permissions: any;
    next_action: {
      type: string;
      heading: string;
      description: string;
      context: string | null;
      style: 'primary' | 'success' | 'warning' | 'info' | 'muted' | 'danger';
      is_terminal: boolean;
      is_waiting: boolean;
    } | null;
    view_level: string;
    is_requestor_only: boolean;
  }>({
    queryKey: ['/api/calling-requests', id],
    queryFn: () => authFetch(token, `/api/calling-requests/${id}`),
    enabled: !!token && !!id,
    staleTime: 15000,
  });

  const handleRefresh = useCallback(() => {
    refetch();
    qClient.invalidateQueries({ queryKey: ['/api/calling-requests/pending-action-count'] });
  }, [refetch, qClient]);

  const performAction = async (action: string, label: string) => {
    setActionLoading(action);
    try {
      await authFetch(token, `/api/calling-requests/${requestId}/${action}`, { method: 'POST' });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleRefresh();
    } catch (err: any) {
      Alert.alert('Error', err.message || `Failed to ${label.toLowerCase()}.`);
    } finally {
      setActionLoading('');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.brand.error} />
        <Text style={styles.errorText}>Unable to load request details</Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const detail = data.calling_request;
  const perms = data.permissions;
  const nextAction = data.next_action;
  const viewLevel = data.view_level;
  const isRequestorOnly = data.is_requestor_only;
  const statusColors = STATUS_COLORS[detail.status] || STATUS_COLORS.draft;

  const callingName = typeof detail.target_calling === 'object' && detail.target_calling?.name
    ? detail.target_calling.name
    : (typeof detail.target_calling === 'string' ? detail.target_calling : detail.request_type_label);
  const wardName = typeof detail.target_ward === 'object' ? detail.target_ward?.name : detail.target_ward;
  const orgName = typeof detail.target_organization === 'object' ? detail.target_organization?.name : detail.target_organization;

  const hasApprovals = detail.approval_authority === 'high_council';
  const hasSteps = detail.steps && detail.steps.length > 0;
  const isGovernance = !isRequestorOnly && ['full', 'presidency', 'ward_authority', 'voter'].includes(viewLevel);

  const tabs: { key: string; label: string }[] = [];
  if (isGovernance) {
    tabs.push({ key: 'discussion', label: 'Discussion' });
    if (hasApprovals) tabs.push({ key: 'approvals', label: 'Approvals' });
    if (hasSteps) tabs.push({ key: 'steps', label: 'Required Steps' });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + webBottomInset + 24 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={Colors.brand.primary} colors={[Colors.brand.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn.duration(300)} style={styles.headerCard}>
        <Text style={styles.headerTitle}>{callingName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColors.text }]} />
          <Text style={[styles.statusLabel, { color: statusColors.text }]}>{detail.status_label}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaChip}>{detail.request_type_label}</Text>
          <Text style={styles.metaChip}>{detail.scope === 'stake' ? 'Stake' : 'Ward'}</Text>
          {detail.approval_authority_label && <Text style={styles.metaChip}>{detail.approval_authority_label}</Text>}
        </View>
        {(wardName || orgName) && (
          <Text style={styles.headerSubtitle}>
            {[wardName, orgName].filter(Boolean).join(' \u00B7 ')}
          </Text>
        )}
        {detail.current_holder && (
          <Text style={styles.holderText}>Current: {detail.current_holder.name}</Text>
        )}
      </Animated.View>

      {nextAction && (
        <NextActionBanner
          nextAction={nextAction}
          onActionPress={(type) => {
            if (['vote', 'voted'].includes(type)) setActiveTab('approvals');
            else if (['decide', 'decide_after_voting', 'decide_or_vote', 'provide_recommendation', 'respond_feedback'].includes(type)) setActiveTab('discussion');
            else if (['next_step', 'assign_interviewer', 'mark_complete', 'waiting_setting_apart'].includes(type)) setActiveTab('steps');
            else if (type === 'submit') performAction('submit', 'Submit');
            else if (type === 'begin_review') performAction('move-to-discussion', 'Begin Review');
          }}
        />
      )}

      {(perms.can_move_to_discussion || perms.can_move_to_voting || perms.can_complete || perms.can_cancel) && (
        <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.actionsRow}>
          {perms.can_move_to_discussion && (
            <ActionButton label="Begin Review" icon="play-circle-outline" onPress={() => performAction('move-to-discussion', 'Begin Review')} loading={actionLoading === 'move-to-discussion'} />
          )}
          {perms.can_move_to_voting && (
            <ActionButton label="Request Approvals" icon="hand-left-outline" onPress={() => performAction('move-to-voting', 'Request Approvals')} loading={actionLoading === 'move-to-voting'} />
          )}
          {perms.can_complete && (
            <ActionButton label="Mark Complete" icon="checkmark-circle-outline" onPress={() => performAction('complete', 'Mark Complete')} loading={actionLoading === 'complete'} />
          )}
          {perms.can_cancel && (
            <ActionButton label="Cancel Request" icon="close-circle-outline" onPress={() => {
              Alert.alert('Cancel Request', 'Are you sure you want to cancel this calling request?', [
                { text: 'No', style: 'cancel' },
                { text: 'Yes, Cancel', style: 'destructive', onPress: () => performAction('cancel', 'Cancel') },
              ]);
            }} variant="danger" loading={actionLoading === 'cancel'} />
          )}
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.duration(300).delay(150)} style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Individual(s) Prayerfully Considered</Text>
        {(detail.individuals || []).map((ind: any, idx: number) => (
          <View key={ind.id} style={styles.individualRow}>
            <View style={styles.individualInfo}>
              <Text style={styles.individualName}>
                {ind.name}
                {ind.is_selected ? ' \u2713' : ''}
              </Text>
              {ind.requires_release_from_current && ind.current_calling && (
                <View style={styles.releaseIndicator}>
                  <Ionicons name="alert-circle" size={14} color="#DC2626" />
                  <Text style={styles.releaseIndicatorText}>
                    Release required from {ind.current_calling.name}
                  </Text>
                </View>
              )}
              {(isRequestorOnly || isGovernance) && ind.recommendation && (
                <Text style={styles.individualRec}>{ind.recommendation}</Text>
              )}
            </View>
            {perms.can_select_individual && (detail.individuals || []).length > 1 && !ind.is_selected && (
              <Pressable
                onPress={async () => {
                  try {
                    await authFetch(token, `/api/calling-requests/${requestId}/select-nominee`, {
                      method: 'POST', body: { nominee_id: ind.id },
                    });
                    handleRefresh();
                  } catch (err: any) {
                    Alert.alert('Error', err.message);
                  }
                }}
                style={styles.selectBtn}
              >
                <Text style={styles.selectBtnText}>Select</Text>
              </Pressable>
            )}
          </View>
        ))}
      </Animated.View>

      {detail.context_notes && (
        <Animated.View entering={FadeInDown.duration(300).delay(200)} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Context & Background</Text>
          <Text style={styles.contextText}>{detail.context_notes}</Text>
        </Animated.View>
      )}

      {isRequestorOnly && detail.timeline && (
        <Animated.View entering={FadeInDown.duration(300).delay(250)}>
          <TimelineView timeline={detail.timeline} />
        </Animated.View>
      )}

      {isRequestorOnly && detail.steps_progress != null && (
        <Animated.View entering={FadeInDown.duration(300).delay(300)} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Progress</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, detail.steps_progress)}%` }]} />
            </View>
            <Text style={styles.progressPercent}>{Math.round(detail.steps_progress)}%</Text>
          </View>
        </Animated.View>
      )}

      {isGovernance && tabs.length > 0 && (
        <Animated.View entering={FadeInDown.duration(300).delay(250)}>
          <View style={styles.tabBar}>
            {tabs.map(tab => (
              <Pressable
                key={tab.key}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                  setActiveTab(tab.key as any);
                }}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              >
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionCard}>
            {activeTab === 'discussion' && (
              <DiscussionSection
                detail={detail}
                permissions={perms}
                requestId={requestId}
                token={token}
                onRefresh={handleRefresh}
              />
            )}
            {activeTab === 'approvals' && hasApprovals && (
              <VotingSection
                detail={detail}
                permissions={perms}
                requestId={requestId}
                token={token}
                userId={user?.id || 0}
                onRefresh={handleRefresh}
              />
            )}
            {activeTab === 'steps' && hasSteps && (
              <StepsSection
                steps={detail.steps}
                canManage={perms.can_manage_steps}
                requestId={requestId}
                token={token}
                onRefresh={handleRefresh}
                sundayBusinessGate={detail.sunday_business_gate || null}
              />
            )}
          </View>
        </Animated.View>
      )}

      {viewLevel === 'monitor' && !isRequestorOnly && (
        <Animated.View entering={FadeInDown.duration(300).delay(250)} style={styles.sectionCard}>
          <Text style={styles.monitorNote}>
            You have monitor access to this calling request. Detailed deliberation information is only visible to governance participants.
          </Text>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.duration(300).delay(350)} style={styles.metaCard}>
        {detail.submitted_by && (
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>Submitted by</Text>
            <Text style={styles.metaValue}>{typeof detail.submitted_by === 'object' ? detail.submitted_by.name : detail.submitted_by}</Text>
          </View>
        )}
        {detail.submitted_at && (
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>Submitted</Text>
            <Text style={styles.metaValue}>{new Date(detail.submitted_at).toLocaleDateString()}</Text>
          </View>
        )}
        {detail.decided_by && (
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>Decision by</Text>
            <Text style={styles.metaValue}>{typeof detail.decided_by === 'object' ? detail.decided_by.name : detail.decided_by}</Text>
          </View>
        )}
        {detail.decided_at && (
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>Decision date</Text>
            <Text style={styles.metaValue}>{new Date(detail.decided_at).toLocaleDateString()}</Text>
          </View>
        )}
        {detail.decision_feedback && (
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>Decision feedback</Text>
            <Text style={styles.metaValue}>{detail.decision_feedback}</Text>
          </View>
        )}
        {detail.interviewer && (
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>Interviewed by</Text>
            <Text style={styles.metaValue}>{detail.interviewer.name}</Text>
          </View>
        )}
        <View style={styles.metaLine}>
          <Text style={styles.metaLabel}>Last updated</Text>
          <Text style={styles.metaValue}>{new Date(detail.updated_at).toLocaleDateString()}</Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { fontSize: 14, color: Colors.brand.midGray, marginTop: 12, fontFamily: 'Inter_400Regular' },
  errorText: { fontSize: 16, color: Colors.brand.dark, marginTop: 12, fontFamily: 'Inter_600SemiBold' },
  retryBtn: { marginTop: 16, backgroundColor: Colors.brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: Colors.brand.white, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  headerCard: {
    backgroundColor: Colors.brand.white, marginHorizontal: 16, marginTop: 16, borderRadius: 14,
    padding: 20, shadowColor: 'rgba(15, 23, 42, 0.1)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3,
  },
  headerTitle: { fontSize: 22, fontWeight: '700' as const, color: Colors.brand.dark, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, gap: 6, marginBottom: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  metaChip: { fontSize: 11, color: Colors.brand.darkGray, backgroundColor: Colors.brand.sectionBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, fontFamily: 'Inter_500Medium', overflow: 'hidden' },
  headerSubtitle: { fontSize: 14, color: Colors.brand.darkGray, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  holderText: { fontSize: 13, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular', marginTop: 4 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: 12 },
  sectionCard: {
    backgroundColor: Colors.brand.white, marginHorizontal: 16, marginTop: 14, borderRadius: 14,
    padding: 20, shadowColor: 'rgba(15, 23, 42, 0.1)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.brand.dark, marginBottom: 14, fontFamily: 'Inter_700Bold', borderLeftWidth: 3, borderLeftColor: Colors.brand.primary, paddingLeft: 10 },
  individualRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.brand.lightGray },
  individualInfo: { flex: 1 },
  individualName: { fontSize: 15, fontWeight: '600' as const, color: Colors.brand.dark, fontFamily: 'Inter_600SemiBold' },
  individualRec: { fontSize: 13, color: Colors.brand.darkGray, marginTop: 4, fontFamily: 'Inter_400Regular' },
  releaseIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' as const },
  releaseIndicatorText: { fontSize: 12, color: '#DC2626', fontFamily: 'Inter_500Medium' },
  selectBtn: { backgroundColor: Colors.brand.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  selectBtnText: { fontSize: 12, color: Colors.brand.white, fontFamily: 'Inter_600SemiBold' },
  contextText: { fontSize: 14, color: Colors.brand.darkGray, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 6, backgroundColor: Colors.brand.lightGray, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.brand.primary, borderRadius: 3 },
  progressPercent: { fontSize: 13, fontWeight: '600' as const, color: Colors.brand.darkGray, fontFamily: 'Inter_600SemiBold' },
  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, backgroundColor: Colors.brand.sectionBg, borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: Colors.brand.white },
  tabText: { fontSize: 13, fontWeight: '500' as const, color: Colors.brand.midGray, fontFamily: 'Inter_500Medium' },
  tabTextActive: { color: Colors.brand.primary, fontFamily: 'Inter_700Bold' },
  monitorNote: { fontSize: 13, color: Colors.brand.midGray, fontStyle: 'italic' as const, textAlign: 'center', lineHeight: 19, fontFamily: 'Inter_400Regular' },
  metaCard: {
    backgroundColor: Colors.brand.white, marginHorizontal: 16, marginTop: 14, borderRadius: 14,
    padding: 20, shadowColor: 'rgba(15, 23, 42, 0.1)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3,
  },
  metaLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.brand.lightGray },
  metaLabel: { fontSize: 13, color: Colors.brand.midGray, fontFamily: 'Inter_500Medium' },
  metaValue: { fontSize: 13, color: Colors.brand.dark, fontFamily: 'Inter_500Medium', textAlign: 'right', flex: 1, marginLeft: 12 },
});
