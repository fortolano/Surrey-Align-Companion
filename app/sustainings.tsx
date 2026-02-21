import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import Colors from '@/constants/colors';

interface Individual {
  id: number;
  name: string;
  is_selected: boolean;
}

interface ActionItem {
  id: number;
  target_calling: string | null;
  request_type_label: string;
  scope: 'stake' | 'ward';
  status: string;
  status_label: string;
  action_label: string;
  action_type: string;
  individuals: Individual[];
  target_ward?: string | null;
}

function isHC(calling: string | undefined): boolean {
  if (!calling) return false;
  const lower = calling.toLowerCase();
  return lower.includes('high council') || lower.includes('high councilor');
}

function InlineVoteCard({
  item,
  index,
  token,
  canVote,
  onRefresh,
}: {
  item: ActionItem;
  index: number;
  token: string | null;
  canVote: boolean;
  onRefresh: () => void;
}) {
  const [vote, setVote] = useState<'approve' | 'disapprove' | ''>('');
  const [nomineeId, setNomineeId] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const actionLower = item.action_label.toLowerCase();
  const typeLower = item.action_type.toLowerCase();
  const isVoteAction = typeLower === 'vote' || typeLower.includes('recommend') || typeLower.includes('sustain') || actionLower.includes('recommendation') || actionLower.includes('sustain') || actionLower.includes('vote');
  const individualsText = item.individuals?.map((i) => i.name).join(', ') || '';

  const submitVote = async () => {
    if (!vote) {
      Alert.alert('Required', 'Please select Approve or Not Approved.');
      return;
    }
    if (item.individuals.length > 1 && !nomineeId) {
      Alert.alert('Required', 'Please select which individual.');
      return;
    }
    setSubmitting(true);
    try {
      await authFetch(token, `/api/calling-requests/${item.id}/vote`, {
        method: 'POST',
        body: {
          vote,
          nominee_id: nomineeId || item.individuals[0]?.id,
          comment: comment.trim() || null,
          is_private: isPrivate,
        },
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      onRefresh();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(350).delay(Math.min(index * 60, 300))}>
      <View style={[cardStyles.card, isVoteAction && canVote && !submitted && cardStyles.cardUrgent]}>
        <View style={cardStyles.cardHeader}>
          <View style={cardStyles.headerLeft}>
            <Text style={cardStyles.callingName} numberOfLines={2}>
              {item.target_calling || item.request_type_label}
            </Text>
            {individualsText ? (
              <Text style={cardStyles.nomineeName} numberOfLines={1}>
                {individualsText}
              </Text>
            ) : null}
            {item.target_ward && (
              <Text style={cardStyles.wardLabel}>{item.target_ward}</Text>
            )}
          </View>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: '/calling-detail', params: { id: String(item.id) } });
            }}
            style={({ pressed }) => [cardStyles.detailBtn, pressed && { opacity: 0.7 }]}
            testID={`view-detail-${item.id}`}
          >
            <Ionicons name="open-outline" size={14} color={Colors.brand.primary} />
            <Text style={cardStyles.detailBtnText}>Details</Text>
          </Pressable>
        </View>

        <View style={cardStyles.statusRow}>
          <View style={[cardStyles.statusChip, { backgroundColor: '#fef3c7' }]}>
            <Text style={[cardStyles.statusText, { color: '#92400e' }]}>{item.status_label}</Text>
          </View>
          <Text style={cardStyles.actionLabel}>
            <Ionicons name="arrow-forward" size={12} color="#B45309" /> {item.action_label}
          </Text>
        </View>

        {submitted && (
          <View style={cardStyles.submittedCard}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={cardStyles.submittedText}>Sustaining submitted successfully</Text>
          </View>
        )}

        {canVote && isVoteAction && !submitted && (
          <View style={cardStyles.voteSection}>
            <Text style={cardStyles.voteTitle}>Provide Your Sustaining</Text>

            {item.individuals.length > 1 && (
              <View style={cardStyles.nomineeSelect}>
                <Text style={cardStyles.nomineeSelectLabel}>Select individual:</Text>
                {item.individuals.map((ind) => (
                  <Pressable key={ind.id} onPress={() => setNomineeId(ind.id)} style={cardStyles.radioRow}>
                    <Ionicons
                      name={nomineeId === ind.id ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={Colors.brand.primary}
                    />
                    <Text style={cardStyles.radioText}>{ind.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={cardStyles.voteOptions}>
              <Pressable
                onPress={() => setVote('approve')}
                style={[cardStyles.voteOptionCard, vote === 'approve' && cardStyles.voteOptionApprove]}
              >
                <Ionicons
                  name={vote === 'approve' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={vote === 'approve' ? '#10B981' : Colors.brand.midGray}
                />
                <Text style={[cardStyles.voteOptionText, vote === 'approve' && { color: '#065f46', fontFamily: 'Inter_600SemiBold' }]}>
                  Approve
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setVote('disapprove')}
                style={[cardStyles.voteOptionCard, vote === 'disapprove' && cardStyles.voteOptionDisapprove]}
              >
                <Ionicons
                  name={vote === 'disapprove' ? 'close-circle' : 'ellipse-outline'}
                  size={22}
                  color={vote === 'disapprove' ? '#EF4444' : Colors.brand.midGray}
                />
                <Text style={[cardStyles.voteOptionText, vote === 'disapprove' && { color: '#991B1B', fontFamily: 'Inter_600SemiBold' }]}>
                  Not Approved
                </Text>
              </Pressable>
            </View>

            <TextInput
              style={cardStyles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Add a comment (optional)..."
              placeholderTextColor={Colors.brand.midGray}
              multiline
            />

            <Pressable onPress={() => setIsPrivate(!isPrivate)} style={cardStyles.checkRow}>
              <Ionicons name={isPrivate ? 'checkbox' : 'square-outline'} size={20} color={Colors.brand.primary} />
              <Text style={cardStyles.checkText}>Private comment (Stake President only)</Text>
            </Pressable>

            <Pressable
              onPress={submitVote}
              style={[cardStyles.submitBtn, !vote && { opacity: 0.5 }]}
              disabled={submitting || !vote}
              testID={`submit-sustaining-${item.id}`}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.brand.white} />
              ) : (
                <Text style={cardStyles.submitBtnText}>Submit Sustaining</Text>
              )}
            </Pressable>
          </View>
        )}

        {!canVote && (
          <View style={cardStyles.viewOnlyBar}>
            <Ionicons name="eye-outline" size={16} color={Colors.brand.primary} />
            <Text style={cardStyles.viewOnlyText}>Tap Details to view voting progress</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function SustainingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const qClient = useQueryClient();
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const userIsHC = isHC(user?.calling);
  const userIsSP = user?.is_stake_presidency ?? false;
  const canVote = userIsHC;

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<{
    success: boolean;
    action_required?: Array<any>;
    calling_requests?: Array<any>;
    action_items?: Array<any>;
    meta?: { total: number };
    total_count?: number;
  }>({
    queryKey: ['/api/calling-requests/action-required'],
    queryFn: () => authFetch(token, '/api/calling-requests/action-required'),
    enabled: !!token,
    staleTime: 30000,
  });

  const actionItems = useMemo(() => {
    const rawItems = data?.action_required || data?.calling_requests || data?.action_items || [];
    return rawItems.map((ai: any): ActionItem => ({
      id: ai.id ?? ai.calling_request_id ?? 0,
      target_calling: ai.target_calling ?? ai.calling_name ?? ai.title ?? null,
      request_type_label: ai.request_type_label ?? ai.type_label ?? '',
      scope: ai.scope ?? 'stake',
      status: ai.status ?? '',
      status_label: ai.status_label ?? '',
      action_label: ai.action_label ?? ai.action ?? '',
      action_type: ai.action_type ?? '',
      individuals: ai.individuals ?? [],
      target_ward: ai.target_ward ?? ai.ward ?? null,
    }));
  }, [data]);

  const handleRefresh = useCallback(() => {
    refetch();
    qClient.invalidateQueries({ queryKey: ['/api/calling-requests/action-required'] });
  }, [refetch, qClient]);

  const renderItem = ({ item, index }: { item: ActionItem; index: number }) => (
    <InlineVoteCard
      item={item}
      index={index}
      token={token}
      canVote={canVote}
      onRefresh={handleRefresh}
    />
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.brand.error} />
        <Text style={styles.errorText}>Unable to load sustainings</Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {userIsSP && !userIsHC && (
        <View style={styles.roleBar}>
          <Ionicons name="eye-outline" size={16} color={Colors.brand.primary} />
          <Text style={styles.roleBarText}>Stake Presidency View — monitoring only</Text>
        </View>
      )}
      {userIsHC && (
        <View style={styles.roleBarHC}>
          <Ionicons name="hand-left-outline" size={16} color="#B45309" />
          <Text style={styles.roleBarHCText}>
            {actionItems.length} calling{actionItems.length !== 1 ? 's' : ''} awaiting your sustaining
          </Text>
        </View>
      )}

      <FlatList
        data={actionItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + webBottomInset + 24 },
          actionItems.length === 0 && styles.emptyContainer,
        ]}
        scrollEnabled={!!actionItems.length}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.brand.primary}
            colors={[Colors.brand.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="checkmark-circle-outline" size={40} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              No callings need your sustaining right now. New items will appear here when they're ready for review.
            </Text>
          </View>
        }
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
  errorText: {
    fontSize: 16,
    color: Colors.brand.dark,
    marginTop: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: Colors.brand.white,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  roleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#E8F4F8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
  roleBarText: {
    fontSize: 13,
    color: Colors.brand.primary,
    fontFamily: 'Inter_500Medium',
  },
  roleBarHC: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFBEB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FDE68A',
  },
  roleBarHCText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#92400E',
    fontFamily: 'Inter_600SemiBold',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 280,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: 'rgba(15, 23, 42, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    paddingLeft: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  callingName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
    lineHeight: 22,
  },
  nomineeName: {
    fontSize: 14,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  wardLabel: {
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E8F4F8',
  },
  detailBtnText: {
    fontSize: 12,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
    fontFamily: 'Inter_600SemiBold',
  },
  actionLabel: {
    fontSize: 12,
    color: '#B45309',
    fontFamily: 'Inter_500Medium',
  },
  submittedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  submittedText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#065f46',
    fontFamily: 'Inter_600SemiBold',
  },
  voteSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  voteTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    paddingLeft: 10,
  },
  nomineeSelect: {
    marginBottom: 12,
  },
  nomineeSelectLabel: {
    fontSize: 13,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_500Medium',
    marginBottom: 6,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  radioText: {
    fontSize: 14,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
  },
  voteOptions: {
    gap: 8,
    marginBottom: 12,
  },
  voteOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.brand.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.brand.lightGray,
  },
  voteOptionApprove: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  voteOptionDisapprove: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  voteOptionText: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
  },
  commentInput: {
    backgroundColor: Colors.brand.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
    minHeight: 50,
    marginBottom: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  checkText: {
    fontSize: 13,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  submitBtn: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_600SemiBold',
  },
  viewOnlyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F4F8',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  viewOnlyText: {
    fontSize: 13,
    color: Colors.brand.primary,
    fontFamily: 'Inter_500Medium',
  },
});
