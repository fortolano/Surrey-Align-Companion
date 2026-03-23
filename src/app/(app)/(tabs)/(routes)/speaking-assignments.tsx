import React, { useState, useCallback, useMemo } from 'react';
import { webShadowRgba } from '@/lib/web-styles';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import { appAlert } from '@/lib/platform-alert';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import { UI_TOUCH_MIN } from '@/constants/ui';
import AppButton from '@/components/ui/AppButton';
import AppActionButton from '@/components/ui/AppActionButton';
import AppIconButton from '@/components/ui/AppIconButton';
import AppInput from '@/components/ui/AppInput';
import AppPickerTrigger from '@/components/ui/AppPickerTrigger';
import AppSegmentedControl from '@/components/ui/AppSegmentedControl';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function TabBar({ activeTab, onTabChange }: { activeTab: number; onTabChange: (t: number) => void }) {
  return (
    <View style={tabStyles.container}>
      <AppSegmentedControl
        items={[
          { key: '0', label: 'My Assignments' },
          { key: '1', label: 'Schedule' },
        ]}
        activeKey={String(activeTab)}
        onChange={(key) => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onTabChange(Number(key));
        }}
        testIDPrefix="speaking-tab"
      />
    </View>
  );
}

function TimeBadge({ label, isPast }: { label: string; isPast?: boolean }) {
  const bgColor = isPast ? '#F3F4F6' : label === 'Today' ? '#FEF3C7' : label === 'Tomorrow' ? '#DBEAFE' : '#E8F4F8';
  const textColor = isPast ? '#6B7280' : label === 'Today' ? '#92400E' : label === 'Tomorrow' ? '#1E40AF' : Colors.brand.primary;
  return (
    <View style={[badgeS.badge, { backgroundColor: bgColor }]}>
      <Text style={[badgeS.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    pending: { bg: '#FEF3C7', text: '#92400E' },
    accepted: { bg: '#D1FAE5', text: '#065F46' },
    declined: { bg: '#FEE2E2', text: '#991B1B' },
    resolved: { bg: '#DBEAFE', text: '#1E40AF' },
  };
  const c = map[status] || map.pending;
  return (
    <View style={[badgeS.badge, { backgroundColor: c.bg }]}>
      <Text style={[badgeS.text, { color: c.text }]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
    </View>
  );
}

function IncomingSwapCard({ swap, onRespond }: { swap: any; onRespond: (id: number, action: string) => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(300).delay(60)}>
      <View style={[cardS.card, { borderLeftWidth: 4, borderLeftColor: '#F59E0B' }]}>
        <View style={cardS.alertHeader}>
          <View style={[cardS.iconCircle, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="swap-horizontal" size={18} color="#B45309" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={cardS.alertTitle}>Swap Request</Text>
            <Text style={cardS.alertFrom}>From {swap.requester?.name}</Text>
          </View>
        </View>
        <View style={cardS.swapDetails}>
          <View style={cardS.swapRow}>
            <Text style={cardS.swapLabel}>Their assignment:</Text>
            <Text style={cardS.swapValue}>{swap.requester_assignment?.ward} — {swap.requester_assignment?.date_label}</Text>
          </View>
          <View style={cardS.swapRow}>
            <Text style={cardS.swapLabel}>Your assignment:</Text>
            <Text style={cardS.swapValue}>{swap.my_assignment?.ward} — {swap.my_assignment?.date_label}</Text>
          </View>
          {swap.reason ? (
            <Text style={cardS.reasonText}>{`"${swap.reason}"`}</Text>
          ) : null}
        </View>
        <View style={cardS.actionRow}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onRespond(swap.id, 'decline');
            }}
            style={[cardS.actionBtn, cardS.declineBtn]}
          >
            <Ionicons name="close" size={16} color="#991B1B" />
            <Text style={[cardS.actionBtnText, { color: '#991B1B' }]}>Decline</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onRespond(swap.id, 'accept');
            }}
            style={[cardS.actionBtn, cardS.acceptBtn]}
          >
            <Ionicons name="checkmark" size={16} color="#065F46" />
            <Text style={[cardS.actionBtnText, { color: '#065F46' }]}>Accept</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function TopicCard({ topic }: { topic: any }) {
  if (!topic) return null;
  return (
    <Animated.View entering={FadeInDown.duration(300).delay(80)}>
      <View style={[cardS.card, { backgroundColor: '#EFF6FF', borderWidth: 0 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Ionicons name="book-outline" size={16} color={Colors.brand.primary} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.brand.primary, fontFamily: 'Inter_600SemiBold' }}>Current Topic</Text>
        </View>
        <Text style={{ fontSize: 15, color: Colors.brand.dark, fontFamily: 'Inter_400Regular', lineHeight: 22 }}>{topic.content}</Text>
        <Text style={{ fontSize: 15, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular', marginTop: 6 }}>{topic.effective_label}</Text>
      </View>
    </Animated.View>
  );
}

function AssignmentRow({ item, index, onSwapPress }: { item: any; index: number; onSwapPress: (item: any) => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(300).delay(60 + index * 40)}>
      <View style={cardS.card}>
        <View style={cardS.row}>
          <View style={[cardS.iconCircle, { backgroundColor: item.is_past ? '#F3F4F6' : '#E8F4F8' }]}>
            <Ionicons name="mic-outline" size={18} color={item.is_past ? '#6B7280' : Colors.brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[cardS.cardTitle, item.is_past && { color: Colors.brand.midGray }]}>{item.date_label} — {item.ward?.name}</Text>
            </View>
            {item.co_speaker ? (
              <Text style={cardS.subText}>with {item.co_speaker.name}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <TimeBadge label={item.time_label} isPast={item.is_past} />
              {item.has_pending_swap && <StatusBadge status="pending" />}
            </View>
          </View>
          {!item.is_past && !item.has_pending_swap && (
            <AppActionButton
              icon="swap-horizontal-outline"
              label="Swap"
              tone="subtle"
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSwapPress(item);
              }}
              style={cardS.swapBtn}
              testID={`speaking-swap-${item.id}`}
            />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

function AvailabilitySection({ sundays, unavailabilities, onToggle }: { sundays: any[]; unavailabilities: any[]; onToggle: (sunday: any, unavailId?: number) => void }) {
  if (!sundays || sundays.length === 0) return null;

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={sectionS.title}>My Availability</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {sundays.map((s: any) => {
          const isAssigned = s.is_assigned;
          const isUnavailable = s.is_unavailable;
          const unavail = unavailabilities?.find((u: any) => u.speaking_sunday_id === s.id);

          let bgColor = '#D1FAE5';
          let iconName: any = 'checkmark-circle';
          let iconColor = '#065F46';
          let textColor = '#065F46';

          if (isAssigned) {
            bgColor = '#DBEAFE';
            iconName = 'mic';
            iconColor = '#1E40AF';
            textColor = '#1E40AF';
          } else if (isUnavailable) {
            bgColor = '#FEE2E2';
            iconName = 'close-circle';
            iconColor = '#991B1B';
            textColor = '#991B1B';
          }

          return (
            <Pressable
              key={s.id}
              disabled={isAssigned}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onToggle(s, unavail?.id);
              }}
              style={[availS.badge, { backgroundColor: bgColor, opacity: isAssigned ? 0.7 : 1 }]}
            >
              <Ionicons name={iconName} size={14} color={iconColor} />
              <Text style={[availS.badgeText, { color: textColor }]}>{s.date_label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={availS.hint}>Tap a green date to mark unavailable, red to restore</Text>
    </View>
  );
}

function PendingRequestCard({ req }: { req: any }) {
  return (
    <View style={cardS.card}>
      <View style={cardS.row}>
        <View style={[cardS.iconCircle, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="time-outline" size={18} color="#B45309" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardS.cardTitle}>{req.type_label}</Text>
          <Text style={cardS.subText}>
            {req.assignment?.ward} — {req.assignment?.date_label}
            {req.swap_with ? ` → ${req.swap_with.user_name}` : ''}
          </Text>
          {req.reason ? <Text style={[cardS.subText, { fontStyle: 'italic' }]}>{`"${req.reason}"`}</Text> : null}
        </View>
        <StatusBadge status={req.status} />
      </View>
    </View>
  );
}

function SwapModal({ visible, onClose, assignment, speakerOptions, onSubmit, isSubmitting }: {
  visible: boolean;
  onClose: () => void;
  assignment: any;
  speakerOptions: any[];
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}) {
  const [swapType, setSwapType] = useState<'admin_request' | 'swap_proposal'>('admin_request');
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [showTargetPicker, setShowTargetPicker] = useState(false);

  const selectedTargetObj = speakerOptions?.find((t: any) => t.id === selectedTarget);

  const handleSubmit = () => {
    const body: any = {
      speaking_assignment_id: assignment?.id,
      type: swapType,
      reason: reason.trim() || undefined,
    };
    if (swapType === 'swap_proposal' && selectedTargetObj) {
      const selectedUserId = selectedTargetObj.user_id ?? selectedTargetObj.id;
      body.swap_with_user_id = selectedUserId;

      const selectedAssignmentId = selectedTargetObj.swap_with_assignment_id ?? selectedTargetObj.id;
      if (selectedAssignmentId) {
        body.swap_with_assignment_id = selectedAssignmentId;
      }
    }
    onSubmit(body);
  };

  const canSubmit = swapType === 'admin_request'
    || (swapType === 'swap_proposal'
      && selectedTargetObj
      && selectedTargetObj.has_upcoming_assignment !== false);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalS.overlay}>
        <View style={modalS.container}>
          <View style={modalS.header}>
            <Text style={modalS.title}>Request Change</Text>
            <AppIconButton
              icon="close"
              onPress={onClose}
              size={22}
              iconColor={Colors.brand.dark}
              backgroundColor={Colors.brand.offWhite}
              style={modalS.closeBtn}
            />
          </View>

          {assignment && (
            <View style={modalS.assignmentInfo}>
              <Ionicons name="mic-outline" size={16} color={Colors.brand.primary} />
              <Text style={modalS.assignmentText}>{assignment.date_label} — {assignment.ward?.name}</Text>
            </View>
          )}

          <Text style={modalS.label}>Request Type</Text>
          <AppSegmentedControl
            items={[
              { key: 'admin_request', label: 'Ask Admin' },
              { key: 'swap_proposal', label: 'Swap Speaker' },
            ]}
            activeKey={swapType}
            onChange={(value) => {
              if (value === 'admin_request') {
                setSelectedTarget(null);
              }
              setSwapType(value as 'admin_request' | 'swap_proposal');
            }}
            style={modalS.typeRow}
            testIDPrefix="speaking-request-type"
          />

          {swapType === 'swap_proposal' && (
            <>
              <Text style={modalS.label}>Swap With</Text>
              <AppPickerTrigger
                label={selectedTargetObj ? selectedTargetObj.label : 'Select a speaker...'}
                onPress={() => setShowTargetPicker(!showTargetPicker)}
                style={modalS.pickerBtn}
              />
              {selectedTargetObj && selectedTargetObj.has_upcoming_assignment === false && (
                <Text style={modalS.pickerHint}>This speaker is in the pool, but has no upcoming assignment to swap yet.</Text>
              )}
              {showTargetPicker && (
                <ScrollView style={modalS.pickerList} nestedScrollEnabled>
                  {(speakerOptions || []).map((t: any) => (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        if (t.has_upcoming_assignment === false) return;
                        setSelectedTarget(t.id);
                        setShowTargetPicker(false);
                      }}
                      style={[
                        modalS.pickerItem,
                        selectedTarget === t.id && { backgroundColor: Colors.brand.accent },
                        t.has_upcoming_assignment === false && { opacity: 0.45 },
                      ]}
                    >
                      <Text style={modalS.pickerItemText}>{t.label}</Text>
                    </Pressable>
                  ))}
                  {(!speakerOptions || speakerOptions.length === 0) && (
                    <Text style={[modalS.pickerItemText, { padding: 12, color: Colors.brand.midGray }]}>No available swap targets</Text>
                  )}
                </ScrollView>
              )}
            </>
          )}

          <Text style={modalS.label}>Reason (optional)</Text>
          <AppInput
            style={modalS.textInput}
            placeholder="Why do you need this change?"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={500}
          />

          <AppButton
            label="Submit Request"
            onPress={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            loading={isSubmitting}
            size="large"
            style={modalS.submitBtn}
            testID="speaking-submit-request"
          />
        </View>
      </View>
    </Modal>
  );
}

function UnavailableReasonModal({ visible, onClose, onSubmit, isSubmitting }: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isSubmitting: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalS.overlay}>
        <View style={[modalS.container, { maxHeight: 280 }]}>
          <View style={modalS.header}>
            <Text style={modalS.title}>Mark Unavailable</Text>
            <AppIconButton
              icon="close"
              onPress={onClose}
              size={22}
              iconColor={Colors.brand.dark}
              backgroundColor={Colors.brand.offWhite}
              style={modalS.closeBtn}
            />
          </View>
          <Text style={modalS.label}>Reason (optional)</Text>
          <AppInput
            style={modalS.textInput}
            placeholder="e.g., Family vacation"
            value={reason}
            onChangeText={setReason}
            maxLength={255}
          />
          <AppButton
            label="Confirm"
            onPress={() => onSubmit(reason.trim())}
            disabled={isSubmitting}
            loading={isSubmitting}
            size="large"
            style={modalS.submitBtn}
            testID="speaking-confirm-unavailable"
          />
        </View>
      </View>
    </Modal>
  );
}

function ScheduleTab({ token }: { token: string | null }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['speaking-schedule', year, month],
    queryFn: () => authFetch(token, '/api/speaking-assignments/schedule', {
      params: { year: String(year), month: String(month) },
    }),
    enabled: !!token,
    staleTime: 60000,
  });

  const monthsWithData = data?.months_with_sundays || [];
  const sundays = data?.sundays || [];
  const wards = data?.wards || [];
  const assignments = data?.assignments || {};

  // Compute column widths to fill available space
  const TABLE_MARGIN = 16; // 8px each side
  const WARD_COL_MIN = 130;
  const SUNDAY_COL_MIN = 130;
  const availableWidth = containerWidth - TABLE_MARGIN;
  const sundayCount = sundays.length || 1;

  // Give ward column ~25% of space (min 130), rest split among sundays
  const wardColWidth = Math.max(WARD_COL_MIN, Math.round(availableWidth * 0.22));
  const remainingForSundays = availableWidth - wardColWidth;
  const sundayColWidth = Math.max(SUNDAY_COL_MIN, Math.round(remainingForSundays / sundayCount));
  const totalTableWidth = wardColWidth + sundayColWidth * sundayCount;
  const needsScroll = totalTableWidth > availableWidth;

  const tableContent = (
    <View style={[schedS.tableWrap, !needsScroll && { width: availableWidth }]}>
      {/* Header row */}
      <View style={schedS.gridHeaderRow}>
        <View style={[schedS.wardCell, { width: wardColWidth }]}>
          <Text style={schedS.gridHeaderText}>Ward</Text>
        </View>
        {sundays.map((s: any) => (
          <View key={s.id} style={[schedS.sundayCell, { width: sundayColWidth }, s.is_past && { opacity: 0.45 }]}>
            <Text style={schedS.gridHeaderText}>{s.date_label}</Text>
          </View>
        ))}
      </View>
      {/* Data rows */}
      {wards.map((ward: any, wi: number) => (
        <View key={ward.id} style={[schedS.gridRow, wi % 2 === 1 && schedS.gridRowAlt]}>
          <View style={[schedS.wardCell, { width: wardColWidth }]}>
            <Text style={schedS.wardName} numberOfLines={2}>{ward.name}</Text>
          </View>
          {sundays.map((s: any) => {
            const a1 = assignments[`${s.id}_${ward.id}_1`];
            const a2 = assignments[`${s.id}_${ward.id}_2`];
            return (
              <View key={s.id} style={[schedS.sundayCell, { width: sundayColWidth }, s.is_past && { opacity: 0.45 }]}>
                <View style={[schedS.slotCell, a1?.is_me && schedS.slotCellMe]}>
                  {a1 ? (
                    <Text style={[schedS.slotText, a1.is_me && schedS.slotTextMe]} numberOfLines={1}>
                      {a1.is_me ? '★ ' : ''}{a1.user_name}
                    </Text>
                  ) : (
                    <Text style={schedS.slotEmpty}>—</Text>
                  )}
                </View>
                <View style={[schedS.slotCell, a2?.is_me && schedS.slotCellMe]}>
                  {a2 ? (
                    <Text style={[schedS.slotText, a2.is_me && schedS.slotTextMe]} numberOfLines={1}>
                      {a2.is_me ? '★ ' : ''}{a2.user_name}
                    </Text>
                  ) : (
                    <Text style={schedS.slotEmpty}>—</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <View style={schedS.yearRow}>
        <AppIconButton
          icon="chevron-back"
          size={20}
          iconColor={Colors.brand.dark}
          backgroundColor={Colors.brand.offWhite}
          onPress={() => setYear(y => y - 1)}
          style={schedS.yearBtn}
        />
        <Text style={schedS.yearText}>{year}</Text>
        <AppIconButton
          icon="chevron-forward"
          size={20}
          iconColor={Colors.brand.dark}
          backgroundColor={Colors.brand.offWhite}
          onPress={() => setYear(y => y + 1)}
          style={schedS.yearBtn}
        />
      </View>

      <View style={schedS.monthWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={schedS.monthRow}>
          {MONTH_NAMES.map((m, idx) => {
            const monthNum = idx + 1;
            const hasData = monthsWithData.includes(monthNum);
            const isActive = month === monthNum;
            return (
              <Pressable
                key={m}
                onPress={() => { if (hasData) setMonth(monthNum); }}
                style={[schedS.monthPill, isActive && schedS.monthPillActive, !hasData && { opacity: 0.4 }]}
              >
                <Text style={[schedS.monthPillText, isActive && schedS.monthPillTextActive]}>{m}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
          <Text style={{ fontSize: 15, color: Colors.brand.midGray, marginTop: 12, fontFamily: 'Inter_400Regular' }}>Loading schedule...</Text>
        </View>
      ) : isError ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.brand.error} />
          <Text style={{ fontSize: 16, color: Colors.brand.dark, marginTop: 12, fontFamily: 'Inter_600SemiBold' }}>Unable to load schedule</Text>
          <Text style={{ fontSize: 14, color: Colors.brand.midGray, marginTop: 4, fontFamily: 'Inter_400Regular' }}>Check your connection and try again.</Text>
          <AppButton label="Retry" onPress={() => refetch()} size="large" style={{ marginTop: 16, minWidth: 144 }} />
        </View>
      ) : sundays.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Ionicons name="calendar-outline" size={44} color={Colors.brand.midGray} />
          <Text style={{ fontSize: 16, color: Colors.brand.midGray, marginTop: 12, fontFamily: 'Inter_500Medium' }}>No speaking Sundays this month</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                triggerGlobalRefreshIndicator();
                refetch();
              }}
              tintColor={Colors.brand.primary}
              colors={[Colors.brand.primary]}
            />
          }
        >
          {needsScroll ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
              {tableContent}
            </ScrollView>
          ) : (
            tableContent
          )}
        </ScrollView>
      )}
    </View>
  );
}

export default function SpeakingAssignmentsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [swapAssignment, setSwapAssignment] = useState<any>(null);
  const [unavailModal, setUnavailModal] = useState<{ visible: boolean; sunday?: any }>({ visible: false });

  const { data: dashData, isLoading: dashLoading, isError: dashError, refetch: dashRefetch, isRefetching: dashRefetching } = useQuery({
    queryKey: ['speaking-dashboard'],
    queryFn: () => authFetch(token, '/api/speaking-assignments'),
    enabled: !!token && activeTab === 0,
    staleTime: 30000,
  });

  const { data: mySchedData } = useQuery({
    queryKey: ['speaking-my-schedule'],
    queryFn: () => authFetch(token, '/api/speaking-assignments/my-schedule'),
    enabled: !!token && activeTab === 0,
    staleTime: 30000,
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      authFetch(token, `/api/speaking-assignments/swap/${id}/respond`, {
        method: 'POST',
        body: { action },
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['speaking-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['speaking-my-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['speaking-badge'] });
      const msg = data?.message || 'Response submitted.';
      appAlert('Done', msg);
    },
    onError: (err: any) => {
      const msg = err?.message || 'Something went wrong.';
      appAlert('Error', msg);
    },
  });

  const swapMutation = useMutation({
    mutationFn: (body: any) =>
      authFetch(token, '/api/speaking-assignments/swap', {
        method: 'POST',
        body,
      }),
    onSuccess: (data) => {
      setSwapModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['speaking-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['speaking-my-schedule'] });
      const msg = data?.message || 'Request submitted.';
      appAlert('Success', msg);
    },
    onError: (err: any) => {
      const msg = err?.message || 'Something went wrong.';
      appAlert('Error', msg);
    },
  });

  const markUnavailMutation = useMutation({
    mutationFn: ({ speaking_sunday_id, reason }: { speaking_sunday_id: number; reason?: string }) =>
      authFetch(token, '/api/speaking-assignments/unavailable', {
        method: 'POST',
        body: { speaking_sunday_id, reason: reason || undefined },
      }),
    onSuccess: () => {
      setUnavailModal({ visible: false });
      queryClient.invalidateQueries({ queryKey: ['speaking-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['speaking-my-schedule'] });
    },
    onError: (err: any) => {
      const msg = err?.message || 'Could not update availability.';
      appAlert('Error', msg);
    },
  });

  const removeUnavailMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(token, `/api/speaking-assignments/unavailable/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speaking-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['speaking-my-schedule'] });
    },
    onError: (err: any) => {
      const msg = err?.message || 'Could not restore availability.';
      appAlert('Error', msg);
    },
  });

  const handleSwapPress = useCallback((item: any) => {
    setSwapAssignment(item);
    setSwapModalVisible(true);
  }, []);

  const handleRespondSwap = useCallback((id: number, action: string) => {
    appAlert(
      `${action === 'accept' ? 'Accept' : 'Decline'} Swap`,
      `Are you sure you want to ${action} this swap request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: action === 'accept' ? 'Accept' : 'Decline', onPress: () => respondMutation.mutate({ id, action }) },
      ]
    );
  }, [respondMutation]);

  const handleAvailabilityToggle = useCallback((sunday: any, unavailId?: number) => {
    if (unavailId) {
      removeUnavailMutation.mutate(unavailId);
    } else {
      setUnavailModal({ visible: true, sunday });
    }
  }, [removeUnavailMutation]);

  const incomingSwaps = dashData?.incoming_swaps || [];
  const assignments = dashData?.my_upcoming_assignments || [];
  const currentTopic = dashData?.current_topic;
  const pendingRequests = dashData?.my_pending_requests || [];
  const isInPool = dashData?.is_in_pool ?? dashData?.permissions?.is_in_pool ?? false;
  const upcomingSundays = mySchedData?.upcoming_sundays || [];
  const unavailabilities = dashData?.my_unavailabilities || [];
  const speakerOptions = useMemo(() => {
    const availableSpeakers = mySchedData?.available_speakers || [];
    if (availableSpeakers.length > 0) {
      return availableSpeakers;
    }

    const legacySwapTargets = mySchedData?.swap_targets || [];
    return legacySwapTargets.map((t: any) => ({
      ...t,
      user_id: t.user_id ?? null,
      swap_with_assignment_id: t.id,
      has_upcoming_assignment: true,
    }));
  }, [mySchedData]);

  const noAccess = dashError;

  if (activeTab === 0 && dashLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={styles.loadingText}>Loading speaking assignments...</Text>
      </View>
    );
  }

  if (noAccess) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="lock-closed-outline" size={40} color={Colors.brand.midGray} />
        <Text style={styles.errorTitle}>No Access</Text>
        <Text style={styles.errorSub}>{"You don't have access to speaking assignments, or there was a connection issue."}</Text>
        <AppButton label="Retry" onPress={() => dashRefetch()} size="large" style={styles.retryBtn} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 0 ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + WEB_BOTTOM_INSET + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={dashRefetching}
              onRefresh={() => {
                triggerGlobalRefreshIndicator();
                dashRefetch();
                queryClient.invalidateQueries({ queryKey: ['speaking-my-schedule'] });
              }}
              tintColor={Colors.brand.primary}
              colors={[Colors.brand.primary]}
            />
          }
        >
          {incomingSwaps.length > 0 && (
            <View>
              <Text style={sectionS.title}>
                <Ionicons name="alert-circle" size={14} color="#B45309" /> Action Required
              </Text>
              {incomingSwaps.map((s: any) => (
                <IncomingSwapCard key={s.id} swap={s} onRespond={handleRespondSwap} />
              ))}
            </View>
          )}

          <TopicCard topic={currentTopic} />

          {assignments.length > 0 ? (
            <View style={{ marginTop: currentTopic ? 8 : 0 }}>
              <Text style={sectionS.title}>My Schedule</Text>
              {assignments.map((a: any, idx: number) => (
                <AssignmentRow key={a.id} item={a} index={idx} onSwapPress={handleSwapPress} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="mic-off-outline" size={36} color={Colors.brand.midGray} />
              <Text style={styles.emptyTitle}>No upcoming assignments</Text>
              <Text style={styles.emptySub}>{"You don't have any speaking assignments right now."}</Text>
            </View>
          )}

          {isInPool && upcomingSundays.length > 0 && (
            <AvailabilitySection
              sundays={upcomingSundays}
              unavailabilities={unavailabilities}
              onToggle={handleAvailabilityToggle}
            />
          )}

          {pendingRequests.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={sectionS.title}>My Requests</Text>
              {pendingRequests.map((r: any) => (
                <PendingRequestCard key={r.id} req={r} />
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScheduleTab token={token} />
      )}

      <SwapModal
        visible={swapModalVisible}
        onClose={() => setSwapModalVisible(false)}
        assignment={swapAssignment}
        speakerOptions={speakerOptions}
        onSubmit={(body) => swapMutation.mutate(body)}
        isSubmitting={swapMutation.isPending}
      />

      <UnavailableReasonModal
        visible={unavailModal.visible}
        onClose={() => setUnavailModal({ visible: false })}
        onSubmit={(reason) => {
          if (unavailModal.sunday) {
            markUnavailMutation.mutate({ speaking_sunday_id: unavailModal.sunday.id, reason });
          }
        }}
        isSubmitting={markUnavailMutation.isPending}
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.brand.midGray,
    marginTop: 12,
    fontFamily: 'Inter_400Regular',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.brand.dark,
    marginTop: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  errorSub: {
    fontSize: 14,
    color: Colors.brand.midGray,
    marginTop: 6,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    maxWidth: 280,
  },
  retryBtn: {
    marginTop: 16,
    minWidth: 148,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 4,
  },
});

const tabStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.brand.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
});

const badgeS = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});

const sectionS = StyleSheet.create({
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 10,
    marginTop: 16,
  },
});

const cardS = StyleSheet.create({
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 2, 8),
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  subText: {
    fontSize: 15,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
    fontFamily: 'Inter_700Bold',
  },
  alertFrom: {
    fontSize: 15,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  swapDetails: {
    backgroundColor: Colors.brand.offWhite,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    gap: 4,
  },
  swapRow: {
    flexDirection: 'row',
    gap: 6,
  },
  swapLabel: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  swapValue: {
    fontSize: 14,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  reasonText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  declineBtn: {
    backgroundColor: '#FEE2E2',
  },
  acceptBtn: {
    backgroundColor: '#D1FAE5',
  },
  swapBtn: {
    marginLeft: 8,
  },
});

const availS = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    minHeight: UI_TOUCH_MIN,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  hint: {
    fontSize: 15,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 6,
  },
});

const schedS = StyleSheet.create({
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 2,
    gap: 20,
  },
  yearBtn: {
    width: UI_TOUCH_MIN,
    height: UI_TOUCH_MIN,
    borderRadius: UI_TOUCH_MIN / 2,
  },
  yearText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  monthWrap: {
    paddingTop: 2,
    paddingBottom: 10,
  },
  monthRow: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  monthPill: {
    paddingHorizontal: 16,
    minHeight: UI_TOUCH_MIN,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: Colors.brand.offWhite,
    justifyContent: 'center',
  },
  monthPillActive: {
    backgroundColor: Colors.brand.primary,
  },
  monthPillText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_600SemiBold',
  },
  monthPillTextActive: {
    color: Colors.brand.white,
  },
  tableWrap: {
    marginHorizontal: 8,
    marginTop: 6,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    backgroundColor: Colors.brand.white,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    backgroundColor: Colors.brand.primary,
  },
  gridRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
  gridRowAlt: {
    backgroundColor: Colors.brand.offWhite,
  },
  wardCell: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.brand.lightGray,
  },
  wardName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  sundayCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
    gap: 4,
  },
  gridHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  slotCell: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 5,
    minHeight: 28,
    justifyContent: 'center',
  },
  slotCellMe: {
    backgroundColor: '#DBEAFE',
  },
  slotText: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  slotTextMe: {
    fontWeight: '700',
    color: '#1E40AF',
    fontFamily: 'Inter_700Bold',
  },
  slotEmpty: {
    fontSize: 15,
    color: Colors.brand.midGray,
    textAlign: 'center',
  },
});

const modalS = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.brand.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
  },
  closeBtn: {
    borderWidth: 0,
  },
  assignmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.brand.offWhite,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  assignmentText: {
    fontSize: 14,
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
    marginTop: 4,
  },
  typeRow: {
    marginBottom: 12,
  },
  pickerBtn: {
    marginBottom: 8,
  },
  pickerList: {
    maxHeight: 150,
    backgroundColor: Colors.brand.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    marginBottom: 8,
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
  pickerItemText: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
  },
  pickerHint: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  textInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitBtn: {
    marginTop: 4,
  },
});
