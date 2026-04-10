import React, { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { webShadowRgba } from '@/lib/web-styles';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
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
import { ApiResponseError } from '@/lib/api';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import { buildPathWithParams, getSingleParam, withReturnTarget } from '@/lib/navigation-return-target';
import AppListRow from '@/components/ui/AppListRow';
import AppPickerTrigger from '@/components/ui/AppPickerTrigger';
import AppSegmentedControl from '@/components/ui/AppSegmentedControl';
import AppStatusBadge from '@/components/ui/AppStatusBadge';
import {
  type AgendaEntityCard,
  type AgendaEntityType,
  useAgendaEntities,
} from '@/lib/agenda-api';
import {
  type CarryForwardListItem,
  type CarryForwardStatusFilter,
  useCarryForwardEntityList,
} from '@/lib/carry-forward-api';

function entitySubtitle(entity: AgendaEntityCard): string {
  if (entity.has_current_agenda && entity.current_agenda_date_label) {
    return `Current agenda ${entity.current_agenda_date_label}`;
  }

  if (entity.past_count > 0) {
    return `${entity.past_count} past agenda${entity.past_count === 1 ? '' : 's'}`;
  }

  return 'Open this body to review continuity items';
}

function statusTone(status: string) {
  if (status === 'waiting_for_report') {
    return { backgroundColor: '#FEF3C7', textColor: '#92400E' };
  }

  if (status === 'resolved') {
    return { backgroundColor: '#D1FAE5', textColor: '#065F46' };
  }

  return { backgroundColor: '#E8F4F8', textColor: Colors.brand.primary };
}

function summaryLine(item: CarryForwardListItem): string {
  const pieces = [
    item.report_due_label ? `Report ${item.report_due_label}` : null,
    item.next_review_label ? `Review ${item.next_review_label}` : null,
    item.owner?.name ? `Owner ${item.owner.name}` : null,
  ].filter(Boolean);

  return pieces.length > 0 ? pieces.join(' · ') : 'No next review date is set yet';
}

function CarryForwardRow({
  item,
  onPress,
}: {
  item: CarryForwardListItem;
  onPress: () => void;
}) {
  const tone = statusTone(item.current_status);
  const flags = [
    item.support_needed ? 'Support' : null,
    item.training_needed ? 'Training' : null,
    item.decision_needed ? 'Decision' : null,
  ].filter(Boolean);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.itemCard, pressed && styles.cardPressed]}
      accessibilityRole="button"
      testID={`carry-forward-item-${item.id}`}
    >
      <View style={styles.itemHeader}>
        <View style={styles.itemHeaderMain}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.itemMeta} numberOfLines={2}>
            {summaryLine(item)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
      </View>

      <View style={styles.badgeRow}>
        <AppStatusBadge
          label={item.current_status_label}
          backgroundColor={tone.backgroundColor}
          textColor={tone.textColor}
        />
        {flags.map((flag) => (
          <AppStatusBadge
            key={flag}
            label={flag}
            backgroundColor="#F3E8FF"
            textColor="#6D28D9"
          />
        ))}
      </View>

      <Text style={styles.itemSummary} numberOfLines={2}>
        {item.latest_report_back_summary
          || item.latest_decision_summary
          || item.linked_evidence_summary?.summary
          || item.purpose_summary}
      </Text>
    </Pressable>
  );
}

export default function CarryForwardScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    entityType?: string | string[];
    entityId?: string | string[];
    status?: string | string[];
    returnTo?: string | string[];
  }>();
  const selectedEntityType = getSingleParam(params.entityType) as AgendaEntityType | undefined;
  const selectedEntityId = Number(getSingleParam(params.entityId) || 0) || null;
  const routeStatus = getSingleParam(params.status);
  const activeStatus: CarryForwardStatusFilter =
    routeStatus === 'waiting_for_report' || routeStatus === 'resolved' || routeStatus === 'all'
      ? routeStatus
      : 'open';
  const routeReturnTarget = getSingleParam(params.returnTo) || '/more';
  const { data: agendaEntitiesData, isLoading: entitiesLoading, refetch: refetchEntities, isRefetching: entitiesRefreshing } = useAgendaEntities();
  const listQuery = useCarryForwardEntityList(selectedEntityType ?? null, selectedEntityId, activeStatus);
  const [showEntityMenu, setShowEntityMenu] = useState(false);

  const agendaEntities = useMemo(() => agendaEntitiesData?.entities ?? [], [agendaEntitiesData?.entities]);
  const selectedEntity = useMemo(
    () => agendaEntities.find((entity) => entity.entity_type === selectedEntityType && entity.entity_id === selectedEntityId) ?? null,
    [agendaEntities, selectedEntityId, selectedEntityType],
  );
  const currentRouteTarget = useMemo(
    () => buildPathWithParams('/carry-forward', {
      entityType: selectedEntityType ?? undefined,
      entityId: selectedEntityId ?? undefined,
      status: activeStatus,
    }),
    [activeStatus, selectedEntityId, selectedEntityType],
  );

  const hasSelectedEntity = Boolean(selectedEntityType && selectedEntityId);
  const listError = listQuery.error;
  const accessDenied = listError instanceof ApiResponseError && listError.status === 403;

  const handleRefresh = async () => {
    triggerGlobalRefreshIndicator();
    await Promise.all([refetchEntities(), ...(hasSelectedEntity ? [listQuery.refetch()] : [])]);
  };

  const openEntity = (entity: AgendaEntityCard) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();

    router.replace(withReturnTarget('/carry-forward', routeReturnTarget, {
      entityType: entity.entity_type,
      entityId: entity.entity_id,
      status: activeStatus,
    }));
  };

  const openDetail = (item: CarryForwardListItem) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    router.push(withReturnTarget('/carry-forward-detail', currentRouteTarget, {
      itemId: item.id,
      entityType: selectedEntityType ?? undefined,
      entityId: selectedEntityId ?? undefined,
    }));
  };

  const activeEntityName = selectedEntity?.entity_name || listQuery.data?.entity.entity_name || 'Choose a meeting body';

  return (
    <View style={styles.container} testID="carry-forward-screen">
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + WEB_BOTTOM_INSET + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={entitiesRefreshing || listQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.brand.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          <View style={styles.heroCard}>
            <Text style={styles.eyebrow}>Carry-Forward</Text>
            <Text style={styles.heroTitle}>Leadership continuity on your phone</Text>
            <Text style={styles.heroSubtitle}>
              Review open matters, waiting report-back, and resolved threads without losing the meeting context that launched you here.
            </Text>
          </View>

          {entitiesLoading && !agendaEntitiesData ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="large" color={Colors.brand.primary} />
              <Text style={styles.stateTitle}>Loading carry-forward bodies...</Text>
            </View>
          ) : null}

          {!entitiesLoading && agendaEntities.length === 0 ? (
            <View style={styles.stateCard} testID="carry-forward-empty-chooser">
              <MaterialCommunityIcons name="clipboard-clock-outline" size={34} color={Colors.brand.primary} />
              <Text style={styles.stateTitle}>No carry-forward bodies are available</Text>
              <Text style={styles.stateCopy}>
                As soon as you have agenda access for a council, committee, or organization, it will appear here.
              </Text>
            </View>
          ) : null}

          {agendaEntities.length > 0 && !hasSelectedEntity ? (
            <View style={styles.sectionCard} testID="carry-forward-chooser-screen">
              <Text style={styles.sectionTitle}>Choose a meeting body</Text>
              <Text style={styles.sectionSubtitle}>
                Open one council, committee, or organization to see its active carry-forward threads.
              </Text>
              <View style={styles.entityList}>
                {agendaEntities.map((entity, index) => (
                  <View key={`${entity.entity_type}-${entity.entity_id}`}>
                    <AppListRow
                      title={entity.entity_name}
                      subtitle={entitySubtitle(entity)}
                      left={(
                        <View style={styles.entityIcon}>
                          <MaterialCommunityIcons
                            name={entity.entity_kind === 'organization' ? 'account-group-outline' : 'clipboard-text-outline'}
                            size={18}
                            color={Colors.brand.primary}
                          />
                        </View>
                      )}
                      right={<Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />}
                      onPress={() => openEntity(entity)}
                      testID={`carry-forward-entity-${entity.entity_type}-${entity.entity_id}`}
                    />
                    {index < agendaEntities.length - 1 ? <View style={styles.divider} /> : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {hasSelectedEntity ? (
            <View style={styles.sectionCard} testID="carry-forward-list-screen">
              <View style={styles.sectionHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Current body</Text>
                  <Text style={styles.sectionSubtitle}>Switch bodies or narrow the view by status.</Text>
                </View>
              </View>

              <AppPickerTrigger
                label={activeEntityName}
                onPress={() => setShowEntityMenu((current) => !current)}
                style={{ marginTop: 4 }}
              />

              {showEntityMenu ? (
                <View style={styles.menuCard}>
                  {agendaEntities.map((entity) => {
                    const selected = entity.entity_type === selectedEntityType && entity.entity_id === selectedEntityId;

                    return (
                      <Pressable
                        key={`${entity.entity_type}-${entity.entity_id}`}
                        onPress={() => {
                          setShowEntityMenu(false);
                          openEntity(entity);
                        }}
                        style={[styles.menuOption, selected && styles.menuOptionSelected]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.menuTitle, selected && styles.menuTitleSelected]}>
                            {entity.entity_name}
                          </Text>
                          <Text style={styles.menuSubtitle}>{entitySubtitle(entity)}</Text>
                        </View>
                        {selected ? <Ionicons name="checkmark" size={16} color={Colors.brand.primary} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <AppSegmentedControl
                items={[
                  { key: 'open', label: 'Open' },
                  { key: 'waiting_for_report', label: 'Report Due' },
                  { key: 'resolved', label: 'Resolved' },
                ]}
                activeKey={activeStatus}
                onChange={(nextKey) => {
                  router.replace(withReturnTarget('/carry-forward', routeReturnTarget, {
                    entityType: selectedEntityType ?? undefined,
                    entityId: selectedEntityId ?? undefined,
                    status: nextKey,
                  }));
                }}
                style={{ marginTop: 14 }}
                testIDPrefix="carry-forward-status"
              />

              {listQuery.isLoading && !listQuery.data ? (
                <View style={styles.inlineState}>
                  <ActivityIndicator size="small" color={Colors.brand.primary} />
                  <Text style={styles.inlineStateText}>Loading carry-forward items...</Text>
                </View>
              ) : null}

              {accessDenied ? (
                <View style={styles.blockedCard}>
                  <Ionicons name="lock-closed-outline" size={26} color={Colors.brand.error} />
                  <Text style={styles.blockedTitle}>This carry-forward list is blocked</Text>
                  <Text style={styles.blockedCopy}>
                    You can open another body from above, but this one is not available with your current permission level.
                  </Text>
                </View>
              ) : null}

              {!accessDenied && listQuery.isError ? (
                <View style={styles.blockedCard}>
                  <Ionicons name="cloud-offline-outline" size={26} color={Colors.brand.error} />
                  <Text style={styles.blockedTitle}>Unable to load carry-forward right now</Text>
                  <Text style={styles.blockedCopy}>Pull to refresh and try again.</Text>
                </View>
              ) : null}

              {!accessDenied && listQuery.data?.items.length === 0 ? (
                <View style={styles.inlineState}>
                  <Text style={styles.emptyTitle}>Nothing is in this view right now</Text>
                  <Text style={styles.stateCopy}>
                    Try another status tab or switch to a different meeting body.
                  </Text>
                </View>
              ) : null}

              {!accessDenied && (listQuery.data?.items?.length ?? 0) > 0 ? (
                <View style={styles.listWrap}>
                  <View style={styles.metricRow}>
                    <AppStatusBadge
                      label={`${listQuery.data?.meta.total ?? 0} total`}
                      backgroundColor="#E8F4F8"
                      textColor={Colors.brand.primary}
                    />
                    <AppStatusBadge
                      label={`${listQuery.data?.meeting_surface.report_back_due_count ?? 0} report-back due`}
                      backgroundColor="#FEF3C7"
                      textColor="#92400E"
                    />
                  </View>

                  {listQuery.data?.items.map((item) => (
                    <CarryForwardRow
                      key={item.id}
                      item={item}
                      onPress={() => openDetail(item)}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
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
  sectionCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 20,
    padding: 18,
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 3, 10),
    elevation: 3,
  },
  stateCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 3, 10),
    elevation: 3,
  },
  stateTitle: {
    fontSize: 18,
    color: Colors.brand.dark,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  stateCopy: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.midGray,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  entityList: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    overflow: 'hidden',
  },
  entityIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F8F0',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.brand.inputBorder,
  },
  menuCard: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    overflow: 'hidden',
  },
  menuOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuOptionSelected: {
    backgroundColor: Colors.brand.sectionBg,
  },
  menuTitle: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
  },
  menuTitleSelected: {
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  menuSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  inlineState: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  inlineStateText: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  blockedCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    gap: 8,
    alignItems: 'center',
  },
  blockedTitle: {
    fontSize: 16,
    color: '#991B1B',
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  blockedCopy: {
    fontSize: 14,
    lineHeight: 20,
    color: '#991B1B',
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  listWrap: {
    marginTop: 16,
    gap: 12,
  },
  itemCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    backgroundColor: Colors.brand.white,
    padding: 14,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemHeaderMain: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  itemMeta: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  badgeRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemSummary: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  emptyTitle: {
    fontSize: 16,
    color: Colors.brand.dark,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  cardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
});
