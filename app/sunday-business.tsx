import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import Colors from '@/constants/colors';

interface Ward {
  id: number;
  name: string;
}

interface SundayBusinessItem {
  id: number;
  item_type: 'release' | 'sustaining' | 'announcement';
  item_type_label: string;
  person_name: string;
  calling_name: string;
  organization_name: string | null;
  person_ward: { id: number; name: string } | null;
  script_text: string;
  released_at: string;
  wards_completed: number[];
  wards_outstanding: number[];
  ward_names: Record<string, string>;
  completion_progress: number;
}

interface SundayBusinessResponse {
  success: boolean;
  business_items: SundayBusinessItem[];
  wards: Ward[];
}

const TYPE_ORDER: Record<string, number> = { release: 0, sustaining: 1, announcement: 2 };
const TYPE_HEADERS: Record<string, { label: string; icon: string }> = {
  release: { label: 'Releases', icon: 'exit-outline' },
  sustaining: { label: 'Sustainings', icon: 'hand-left-outline' },
  announcement: { label: 'Announcements', icon: 'megaphone-outline' },
};

function BusinessItemCard({ item, selectedWardId, token, onRefresh }: {
  item: SundayBusinessItem;
  selectedWardId: number | null;
  token: string | null;
  onRefresh: () => void;
}) {
  const [marking, setMarking] = useState(false);
  const isConducted = selectedWardId ? item.wards_completed.includes(selectedWardId) : false;
  const isOutstanding = selectedWardId ? item.wards_outstanding.includes(selectedWardId) : false;
  const completedCount = item.wards_completed.length;
  const totalCount = item.wards_completed.length + item.wards_outstanding.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const markConducted = async () => {
    if (!selectedWardId) return;
    setMarking(true);
    try {
      const result = await authFetch(token, `/api/stake-business/${item.id}/complete-ward`, {
        method: 'POST',
        body: { ward_id: selectedWardId },
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (result.calling_step_updated) {
        Alert.alert('Updated', 'The calling lifecycle step has been updated.');
      }
      onRefresh();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to mark as conducted.');
    } finally {
      setMarking(false);
    }
  };

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.personName}>{item.person_name}</Text>
        {isConducted && (
          <View style={cardStyles.conductedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.brand.success} />
            <Text style={cardStyles.conductedText}>Conducted</Text>
          </View>
        )}
      </View>
      <Text style={cardStyles.callingName}>
        {item.item_type === 'release' ? 'Released as ' : 'Called as '}
        {item.calling_name}
      </Text>
      {item.organization_name && (
        <Text style={cardStyles.orgName}>{item.organization_name}</Text>
      )}

      <View style={cardStyles.scriptBlock}>
        <View style={cardStyles.scriptBar} />
        <Text style={cardStyles.scriptText}>{item.script_text}</Text>
      </View>

      <View style={cardStyles.progressRow}>
        <View style={cardStyles.progressTrack}>
          <View style={[cardStyles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={cardStyles.progressLabel}>{completedCount}/{totalCount} wards</Text>
      </View>

      {selectedWardId && isOutstanding && (
        <Pressable
          onPress={markConducted}
          style={cardStyles.conductBtn}
          disabled={marking}
        >
          {marking ? (
            <ActivityIndicator size="small" color={Colors.brand.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={16} color={Colors.brand.white} />
              <Text style={cardStyles.conductBtnText}>Mark as Conducted</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    marginHorizontal: 16,
    shadowColor: 'rgba(15, 23, 42, 0.1)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  personName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  conductedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  conductedText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#065f46',
    fontFamily: 'Inter_600SemiBold',
  },
  callingName: {
    fontSize: 14,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_500Medium',
    marginBottom: 2,
  },
  orgName: {
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  scriptBlock: {
    flexDirection: 'row',
    backgroundColor: Colors.brand.sectionBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  scriptBar: {
    width: 3,
    backgroundColor: Colors.brand.primary,
    borderRadius: 2,
    marginRight: 12,
  },
  scriptText: {
    flex: 1,
    fontSize: 13,
    color: Colors.brand.darkGray,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic' as const,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.brand.lightGray,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.brand.success,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_600SemiBold',
    width: 60,
    textAlign: 'right' as const,
  },
  conductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.brand.primary,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 4,
  },
  conductBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_600SemiBold',
  },
});

export default function SundayBusinessScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const qClient = useQueryClient();
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const [selectedWardId, setSelectedWardId] = useState<number | null>(null);
  const [showWardPicker, setShowWardPicker] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<SundayBusinessResponse>({
    queryKey: ['/api/stake-business/sunday'],
    queryFn: () => authFetch(token, '/api/stake-business/sunday'),
    enabled: !!token,
    staleTime: 30000,
  });

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const wards = data?.wards || [];
  const items = data?.business_items || [];
  const selectedWard = wards.find(w => w.id === selectedWardId);

  const grouped = useMemo(() => {
    const groups: Record<string, SundayBusinessItem[]> = {};
    const sorted = [...items].sort((a, b) => (TYPE_ORDER[a.item_type] ?? 9) - (TYPE_ORDER[b.item_type] ?? 9));
    for (const item of sorted) {
      if (!groups[item.item_type]) groups[item.item_type] = [];
      groups[item.item_type].push(item);
    }
    return groups;
  }, [items]);

  const outstandingWards = useMemo(() => {
    if (items.length === 0 || wards.length === 0) return [];
    return wards.map(ward => {
      const allDone = items.every(item => item.wards_completed.includes(ward.id));
      return { ...ward, allDone };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, wards]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={styles.loadingText}>Loading Sunday business...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.brand.error} />
        <Text style={styles.errorText}>Unable to load Sunday business</Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="checkmark-circle-outline" size={48} color={Colors.brand.success} />
        <Text style={styles.emptyTitle}>All Clear</Text>
        <Text style={styles.emptySubtitle}>No pending Sunday business at this time.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + webBottomInset + 24 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          tintColor={Colors.brand.primary}
          colors={[Colors.brand.primary]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn.duration(300)} style={styles.wardSelector}>
        <Text style={styles.wardPrompt}>Which ward are you visiting today?</Text>
        <Pressable
          onPress={() => setShowWardPicker(!showWardPicker)}
          style={styles.wardDropdown}
        >
          <Text style={[styles.wardDropdownText, !selectedWard && styles.wardPlaceholder]}>
            {selectedWard?.name || 'Select Ward...'}
          </Text>
          <Ionicons
            name={showWardPicker ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.brand.midGray}
          />
        </Pressable>

        {showWardPicker && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.wardList}>
            {wards.map(ward => (
              <Pressable
                key={ward.id}
                onPress={() => {
                  setSelectedWardId(ward.id);
                  setShowWardPicker(false);
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                }}
                style={[
                  styles.wardOption,
                  selectedWardId === ward.id && styles.wardOptionActive,
                ]}
              >
                <Text style={[
                  styles.wardOptionText,
                  selectedWardId === ward.id && styles.wardOptionTextActive,
                ]}>
                  {ward.name}
                </Text>
                {selectedWardId === ward.id && (
                  <Ionicons name="checkmark" size={18} color={Colors.brand.primary} />
                )}
              </Pressable>
            ))}
          </Animated.View>
        )}
      </Animated.View>

      {Object.entries(grouped).map(([type, typeItems], groupIdx) => {
        const header = TYPE_HEADERS[type] || { label: type, icon: 'list-outline' };
        return (
          <Animated.View
            key={type}
            entering={FadeInDown.duration(300).delay(100 + groupIdx * 80)}
          >
            <View style={styles.groupHeader}>
              <Ionicons name={header.icon as any} size={18} color={Colors.brand.primary} />
              <Text style={styles.groupHeaderText}>{header.label}</Text>
              <View style={styles.groupCount}>
                <Text style={styles.groupCountText}>{typeItems.length}</Text>
              </View>
            </View>
            {typeItems.map(item => (
              <BusinessItemCard
                key={item.id}
                item={item}
                selectedWardId={selectedWardId}
                token={token}
                onRefresh={handleRefresh}
              />
            ))}
          </Animated.View>
        );
      })}

      {outstandingWards.length > 0 && (
        <Animated.View entering={FadeInDown.duration(300).delay(400)}>
          <View style={styles.groupHeader}>
            <MaterialCommunityIcons name="format-list-checks" size={18} color={Colors.brand.primary} />
            <Text style={styles.groupHeaderText}>Ward Completion Status</Text>
          </View>
          <View style={styles.outstandingCard}>
            {outstandingWards.map(ward => (
              <View key={ward.id} style={styles.wardCheckRow}>
                {ward.allDone ? (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.brand.success} />
                ) : (
                  <Ionicons name="ellipse-outline" size={20} color={Colors.brand.midGray} />
                )}
                <Text style={[
                  styles.wardCheckName,
                  !ward.allDone && styles.wardCheckOutstanding,
                ]}>
                  {ward.name}
                </Text>
                {!ward.allDone && (
                  <Text style={styles.outstandingLabel}>outstanding</Text>
                )}
              </View>
            ))}
          </View>
        </Animated.View>
      )}
    </ScrollView>
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
    fontSize: 14,
    color: Colors.brand.midGray,
    marginTop: 12,
    fontFamily: 'Inter_400Regular',
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.brand.dark,
    marginTop: 14,
    fontFamily: 'Inter_700Bold',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.brand.midGray,
    marginTop: 6,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center' as const,
  },
  wardSelector: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  wardPrompt: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
  },
  wardDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.brand.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  wardDropdownText: {
    fontSize: 16,
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
  },
  wardPlaceholder: {
    color: Colors.brand.midGray,
  },
  wardList: {
    backgroundColor: Colors.brand.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: 'rgba(15, 23, 42, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  wardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
  wardOptionActive: {
    backgroundColor: Colors.brand.accent,
  },
  wardOptionText: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
  },
  wardOptionTextActive: {
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  groupHeaderText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    flex: 1,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand.primary,
    paddingLeft: 10,
  },
  groupCount: {
    backgroundColor: Colors.brand.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  groupCountText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  outstandingCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    shadowColor: 'rgba(15, 23, 42, 0.1)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  wardCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
  wardCheckName: {
    flex: 1,
    fontSize: 14,
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
  },
  wardCheckOutstanding: {
    color: Colors.brand.midGray,
  },
  outstandingLabel: {
    fontSize: 11,
    color: Colors.brand.warning,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase' as const,
  },
});
