import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { webShadow, webShadowRgba } from '@/lib/web-styles';
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
import { WEB_BOTTOM_INSET } from '@/constants/layout';

interface Ward {
  id: number;
  name: string;
}

interface UserBusinessContext {
  role: 'stake_admin' | 'high_councilor' | 'ward_leader' | 'none';
  label: string;
  can_manage_queue: boolean;
  sees_stake_business: boolean;
  sees_ward_business: boolean;
  ward_ids: number[] | null;
}

interface SundayBusinessItem {
  id: number;
  bundle_id: string | null;
  scope: 'stake' | 'ward';
  item_type: 'release' | 'sustaining';
  item_type_label: string;
  person_name: string;
  calling_name: string;
  organization_name: string | null;
  person_ward: { id: number; name: string } | null;
  target_ward: { id: number; name: string } | null;
  script_text: string;
  released_at: string;
  created_at: string;
  wards_required: number[];
  wards_completed: number[];
  wards_outstanding: number[];
  ward_names: Record<string, string>;
  completion_progress: number;
}

interface SundayBusinessResponse {
  success: boolean;
  user_context: UserBusinessContext;
  business_items: SundayBusinessItem[];
  wards: Ward[];
}

interface CompleteWardResponse {
  success: boolean;
  items_completed: number;
  bundle_id: string | null;
  completion: {
    ward_id: number;
    ward_name: string;
    conducted_at: string;
    conducted_by: string;
  };
  updated_items: {
    id: number;
    status: string;
    wards_completed: number[];
    wards_outstanding: number[];
  }[];
  calling_step_updated: boolean;
}

function TypeGroupCard({ itemType, items, selectedWardId }: {
  itemType: 'release' | 'sustaining';
  items: SundayBusinessItem[];
  selectedWardId: number | null;
}) {
  const pendingItems = selectedWardId
    ? items.filter(i => !i.wards_completed.includes(selectedWardId))
    : items;

  const count = pendingItems.length;
  const title = itemType === 'release'
    ? (count === 1 ? 'Release' : 'Releases')
    : (count === 1 ? 'Sustaining' : 'Sustainings');

  const headerColor = itemType === 'release' ? '#92400e' : '#1e40af';
  const headerBg = itemType === 'release' ? '#fef3c7' : '#dbeafe';
  const accentColor = itemType === 'release' ? '#F59E0B' : '#3B82F6';

  if (count === 0) return null;

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <View style={[cardStyles.typeIndicator, { backgroundColor: accentColor }]} />
        <View style={[cardStyles.headerChip, { backgroundColor: headerBg }]}>
          <Text style={[cardStyles.headerChipText, { color: headerColor }]}>{title.toUpperCase()}</Text>
        </View>
        <Text style={cardStyles.countLabel}>{count} {count === 1 ? 'item' : 'items'}</Text>
      </View>

      {pendingItems.map((item, idx) => (
        <View key={item.id} style={[cardStyles.itemRow, idx > 0 && cardStyles.itemRowBorder]}>
          <View style={cardStyles.itemContent}>
            <Text style={cardStyles.personName}>{item.person_name}</Text>
            <Text style={cardStyles.callingName}>{item.calling_name}</Text>
            {item.organization_name && (
              <Text style={cardStyles.orgName}>{item.organization_name}</Text>
            )}
          </View>
        </View>
      ))}

      <View style={cardStyles.scriptSection}>
        <View style={cardStyles.scriptHeader}>
          <Ionicons name="document-text-outline" size={14} color={Colors.brand.primary} />
          <Text style={cardStyles.scriptHeaderText}>
            {count === 1 ? 'Script' : 'Scripts'}
          </Text>
        </View>
        {pendingItems.map((item, idx) => (
          <View key={item.id} style={[cardStyles.scriptBlock, idx > 0 && { marginTop: 10 }]}>
            {count > 1 && (
              <Text style={cardStyles.scriptPersonLabel}>{item.person_name}:</Text>
            )}
            <View style={cardStyles.scriptTextRow}>
              <View style={[cardStyles.scriptBar, { backgroundColor: accentColor }]} />
              <Text style={cardStyles.scriptText}>{item.script_text}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    marginHorizontal: 16,
    ...webShadowRgba('rgba(15, 23, 42, 0.1)', 0, 3, 10),
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  typeIndicator: {
    width: 4,
    height: 24,
    borderRadius: 2,
  },
  headerChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  headerChipText: {
    fontSize: 12,
    fontWeight: '700' as const,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  countLabel: {
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  allDoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  allDoneText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#065f46',
    fontFamily: 'Inter_600SemiBold',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 10,
  },
  itemRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.brand.lightGray,
  },
  itemContent: {
    flex: 1,
  },
  personName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  callingName: {
    fontSize: 13,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  orgName: {
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  scriptSection: {
    marginTop: 14,
    backgroundColor: Colors.brand.sectionBg,
    borderRadius: 12,
    padding: 14,
  },
  scriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  scriptHeaderText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  scriptBlock: {},
  scriptPersonLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  scriptTextRow: {
    flexDirection: 'row',
  },
  scriptBar: {
    width: 3,
    borderRadius: 2,
    marginRight: 10,
  },
  scriptText: {
    flex: 1,
    fontSize: 15,
    color: Colors.brand.dark,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic' as const,
  },
});

export default function SundayBusinessScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const qClient = useQueryClient();
  const webBottomInset = WEB_BOTTOM_INSET;

  const [selectedWardId, setSelectedWardId] = useState<number | null>(null);
  const [showWardPicker, setShowWardPicker] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<SundayBusinessResponse>({
    queryKey: ['/api/sunday-business/sunday'],
    queryFn: () => authFetch(token, '/api/sunday-business/sunday'),
    enabled: !!token,
    staleTime: 30000,
  });

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const wards = data?.wards || [];
  const allItems = data?.business_items || [];
  const userContext = data?.user_context;
  const selectedWard = wards.find(w => w.id === selectedWardId);

  useEffect(() => {
    if (userContext?.role === 'ward_leader' && userContext.ward_ids && userContext.ward_ids.length > 0 && !selectedWardId) {
      setSelectedWardId(userContext.ward_ids[0]);
    }
  }, [userContext, selectedWardId]);

  const wardItems = useMemo(() => {
    if (!selectedWardId) return allItems;
    return allItems.filter(item => item.wards_required.includes(selectedWardId));
  }, [allItems, selectedWardId]);

  const releaseItems = useMemo(() => wardItems.filter(i => i.item_type === 'release'), [wardItems]);
  const sustainingItems = useMemo(() => wardItems.filter(i => i.item_type === 'sustaining'), [wardItems]);

  const outstandingWardItems = useMemo(() => {
    if (!selectedWardId) return [];
    return wardItems.filter(i => i.wards_outstanding.includes(selectedWardId));
  }, [wardItems, selectedWardId]);

  const allWardItemsConducted = useMemo(() => {
    if (!selectedWardId || wardItems.length === 0) return false;
    return wardItems.every(i => i.wards_completed.includes(selectedWardId));
  }, [wardItems, selectedWardId]);

  const markAllConducted = useCallback(async () => {
    if (!selectedWardId || outstandingWardItems.length === 0) return;
    setMarkingAll(true);
    try {
      const processedBundles = new Set<string>();
      let anyStepUpdated = false;

      for (const item of outstandingWardItems) {
        const bundleKey = item.bundle_id ?? `standalone_${item.id}`;
        if (processedBundles.has(bundleKey)) continue;
        processedBundles.add(bundleKey);

        const result: CompleteWardResponse = await authFetch(token, `/api/sunday-business/${item.id}/complete-ward`, {
          method: 'POST',
          body: { ward_id: selectedWardId },
        });
        if (result.calling_step_updated) anyStepUpdated = true;
        if (result.updated_items) {
          qClient.setQueryData<SundayBusinessResponse>(['/api/sunday-business/sunday'], (old) => {
            if (!old) return old;
            const newItems = old.business_items.map(bi => {
              const update = result.updated_items.find(u => u.id === bi.id);
              if (update) {
                return { ...bi, wards_completed: update.wards_completed, wards_outstanding: update.wards_outstanding };
              }
              return bi;
            });
            return { ...old, business_items: newItems };
          });
        }
      }

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (anyStepUpdated) {
        Alert.alert('Updated', 'Calling lifecycle steps have been updated.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to mark as conducted.');
    } finally {
      setMarkingAll(false);
    }
  }, [selectedWardId, outstandingWardItems, token, qClient]);

  const relevantWards = useMemo(() => {
    if (allItems.length === 0 || wards.length === 0) return [];
    const requiredSet = new Set<number>();
    for (const item of allItems) {
      for (const wid of item.wards_required) {
        requiredSet.add(wid);
      }
    }
    return wards
      .filter(w => requiredSet.has(w.id))
      .map(ward => {
        const wardItemsForWard = allItems.filter(item => item.wards_required.includes(ward.id));
        const doneCount = wardItemsForWard.filter(item => item.wards_completed.includes(ward.id)).length;
        return { ...ward, allDone: doneCount === wardItemsForWard.length && wardItemsForWard.length > 0, doneCount, totalCount: wardItemsForWard.length };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allItems, wards]);

  const showWardSelector = userContext?.role !== 'ward_leader';
  const wardPromptText = userContext?.role === 'high_councilor'
    ? 'Which ward are you attending this Sunday?'
    : 'Select a ward to view business';

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

  if (allItems.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="checkmark-circle-outline" size={48} color={Colors.brand.success} />
        <Text style={styles.emptyTitle}>All Clear</Text>
        <Text style={styles.emptySubtitle}>No pending Sunday business at this time.</Text>
      </View>
    );
  }

  const noItemsForWard = selectedWardId && wardItems.length === 0;

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
      <View style={styles.contentWrap}>
        {showWardSelector && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.wardSelector}>
            <Text style={styles.wardPrompt}>{wardPromptText}</Text>

            {showWardPicker ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.wardGrid}>
                {relevantWards.map(ward => (
                  <Pressable
                    key={ward.id}
                    onPress={() => {
                      setSelectedWardId(ward.id);
                      setShowWardPicker(false);
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                    }}
                    style={[
                      styles.wardChip,
                      selectedWardId === ward.id && styles.wardChipActive,
                      ward.allDone && styles.wardChipDone,
                    ]}
                  >
                    <Text style={[
                      styles.wardChipText,
                      selectedWardId === ward.id && styles.wardChipTextActive,
                      ward.allDone && styles.wardChipTextDone,
                    ]}>
                      {ward.name}
                    </Text>
                    {ward.allDone && (
                      <Ionicons name="checkmark-circle" size={14} color={Colors.brand.success} />
                    )}
                  </Pressable>
                ))}
              </Animated.View>
            ) : (
              <Pressable
                onPress={() => setShowWardPicker(true)}
                style={styles.wardDropdown}
              >
                <Text style={[styles.wardDropdownText, !selectedWard && styles.wardPlaceholder]}>
                  {selectedWard?.name || 'Select Ward...'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={Colors.brand.midGray} />
              </Pressable>
            )}
          </Animated.View>
        )}

        {!selectedWardId && showWardSelector && (
          <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.promptCard}>
            <MaterialCommunityIcons name="gesture-tap" size={32} color={Colors.brand.midGray} />
            <Text style={styles.promptText}>Select a ward above to see the releases and sustainings you need to conduct.</Text>
          </Animated.View>
        )}

        {noItemsForWard && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.promptCard}>
            <Ionicons name="checkmark-circle-outline" size={32} color={Colors.brand.success} />
            <Text style={styles.promptText}>No pending business for {selectedWard?.name} at this time.</Text>
          </Animated.View>
        )}

        {selectedWardId && wardItems.length > 0 && (
          <>
            <View style={styles.wardSummary}>
              <Text style={styles.wardSummaryText}>
                {selectedWard?.name} has {wardItems.length} {wardItems.length === 1 ? 'item' : 'items'} to conduct
              </Text>
            </View>

            {releaseItems.length > 0 && (
              <Animated.View entering={FadeInDown.duration(300).delay(100)}>
                <TypeGroupCard
                  itemType="release"
                  items={releaseItems}
                  selectedWardId={selectedWardId}
                />
              </Animated.View>
            )}

            {sustainingItems.length > 0 && (
              <Animated.View entering={FadeInDown.duration(300).delay(200)}>
                <TypeGroupCard
                  itemType="sustaining"
                  items={sustainingItems}
                  selectedWardId={selectedWardId}
                />
              </Animated.View>
            )}

            {allWardItemsConducted ? (
              <Animated.View entering={FadeInDown.duration(300).delay(300)} style={styles.allDoneCard}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.brand.success} />
                <Text style={styles.allDoneCardText}>All business conducted for {selectedWard?.name}</Text>
              </Animated.View>
            ) : outstandingWardItems.length > 0 ? (
              <Animated.View entering={FadeInDown.duration(300).delay(300)}>
                <Pressable
                  onPress={markAllConducted}
                  style={styles.masterConductBtn}
                  disabled={markingAll}
                >
                  {markingAll ? (
                    <ActivityIndicator size="small" color={Colors.brand.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={22} color={Colors.brand.white} />
                      <Text style={styles.masterConductBtnText}>
                        {outstandingWardItems.length === 1
                          ? `Mark ${outstandingWardItems[0].item_type === 'release' ? 'Release' : 'Sustaining'} as Conducted`
                          : `Mark All ${outstandingWardItems.length} Items as Conducted`}
                      </Text>
                    </>
                  )}
                </Pressable>
              </Animated.View>
            ) : null}
          </>
        )}

        {!showWardSelector && wardItems.length > 0 && (
          <>
          {releaseItems.length > 0 && (
            <Animated.View entering={FadeInDown.duration(300).delay(100)}>
              <TypeGroupCard
                itemType="release"
                items={releaseItems}
                selectedWardId={selectedWardId}
              />
            </Animated.View>
          )}

          {sustainingItems.length > 0 && (
            <Animated.View entering={FadeInDown.duration(300).delay(200)}>
              <TypeGroupCard
                itemType="sustaining"
                items={sustainingItems}
                selectedWardId={selectedWardId}
              />
            </Animated.View>
          )}

          {allWardItemsConducted ? (
            <Animated.View entering={FadeInDown.duration(300).delay(300)} style={styles.allDoneCard}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.brand.success} />
              <Text style={styles.allDoneCardText}>All business conducted</Text>
            </Animated.View>
          ) : outstandingWardItems.length > 0 ? (
            <Animated.View entering={FadeInDown.duration(300).delay(300)}>
              <Pressable
                onPress={markAllConducted}
                style={styles.masterConductBtn}
                disabled={markingAll}
              >
                {markingAll ? (
                  <ActivityIndicator size="small" color={Colors.brand.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={22} color={Colors.brand.white} />
                    <Text style={styles.masterConductBtnText}>
                      {outstandingWardItems.length === 1
                        ? `Mark ${outstandingWardItems[0].item_type === 'release' ? 'Release' : 'Sustaining'} as Conducted`
                        : `Mark All ${outstandingWardItems.length} Items as Conducted`}
                    </Text>
                  </>
                )}
              </Pressable>
            </Animated.View>
          ) : null}
          </>
        )}

        {showWardSelector && relevantWards.length > 0 && (
          <Animated.View entering={FadeInDown.duration(300).delay(400)}>
            <View style={styles.groupHeader}>
              <MaterialCommunityIcons name="format-list-checks" size={18} color={Colors.brand.primary} />
              <Text style={styles.groupHeaderText}>Ward Progress</Text>
            </View>
            <View style={styles.outstandingCard}>
              {relevantWards.map(ward => (
                <Pressable
                  key={ward.id}
                  onPress={() => {
                    setSelectedWardId(ward.id);
                    setShowWardPicker(false);
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                  }}
                  style={styles.wardCheckRow}
                >
                  {ward.allDone ? (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.brand.success} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color={Colors.brand.midGray} />
                  )}
                  <Text style={[
                    styles.wardCheckName,
                    ward.allDone && styles.wardCheckDone,
                    selectedWardId === ward.id && styles.wardCheckSelected,
                  ]}>
                    {ward.name}
                  </Text>
                  <Text style={styles.wardCheckCount}>
                    {ward.doneCount}/{ward.totalCount}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
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
    marginBottom: 10,
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
  wardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.brand.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  wardChipActive: {
    borderColor: Colors.brand.primary,
    backgroundColor: Colors.brand.accent,
  },
  wardChipDone: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  wardChipText: {
    fontSize: 14,
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
  },
  wardChipTextActive: {
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  wardChipTextDone: {
    color: '#065f46',
  },
  promptCard: {
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 40,
    gap: 12,
  },
  promptText: {
    fontSize: 15,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center' as const,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  wardSummary: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  wardSummaryText: {
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
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
  outstandingCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 4,
    marginHorizontal: 16,
    ...webShadowRgba('rgba(15, 23, 42, 0.1)', 0, 3, 10),
    elevation: 3,
  },
  wardCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
  wardCheckName: {
    flex: 1,
    fontSize: 14,
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
  },
  wardCheckDone: {
    color: Colors.brand.midGray,
  },
  wardCheckSelected: {
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  wardCheckCount: {
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_600SemiBold',
  },
  masterConductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.brand.primary,
    borderRadius: 14,
    paddingVertical: 18,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 8,
    ...webShadow(Colors.brand.primary, 0, 4, 0.3, 8),
    elevation: 4,
  },
  masterConductBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_700Bold',
  },
  allDoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#86efac',
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 8,
  },
  allDoneCardText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#065f46',
    fontFamily: 'Inter_600SemiBold',
  },
});
