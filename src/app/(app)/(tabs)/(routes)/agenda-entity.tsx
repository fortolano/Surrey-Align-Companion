import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import { buildPathWithParams, getSingleParam, withReturnTarget } from '@/lib/navigation-return-target';
import { buildCarryForwardMeetingInstanceKey } from '@/lib/carry-forward-api';
import AppListRow from '@/components/ui/AppListRow';
import AppSegmentedControl from '@/components/ui/AppSegmentedControl';
import AppStatusBadge from '@/components/ui/AppStatusBadge';
import PreparedLeadershipCard from '@/components/PreparedLeadershipCard';
import {
  useAgendaEntity,
  usePublishedAgenda,
  type AgendaPrepBriefPayload,
  type AgendaEntity,
  type AgendaEntityType,
  type AgendaItemData,
  type AgendaSection,
  type AgendaSummary,
  type AgendaSummaryListItem,
} from '@/lib/agenda-api';
import { uniqueLeadershipLines } from '@/lib/leadership-intelligence';

type AgendaTab = 'current' | 'past';

const ITEM_ICONS: Record<string, { name: string; color: string }> = {
  prayer: { name: 'hand-left-outline', color: '#7C3AED' },
  hymn: { name: 'musical-notes-outline', color: '#D97706' },
  speaker: { name: 'mic-outline', color: '#1E40AF' },
  spiritual_thought: { name: 'sunny-outline', color: '#D97706' },
  discussion: { name: 'chatbubble-ellipses-outline', color: Colors.brand.primary },
  action: { name: 'checkmark-square-outline', color: '#065F46' },
  report: { name: 'clipboard-outline', color: '#0F766E' },
  training: { name: 'school-outline', color: '#7C3AED' },
  announcement: { name: 'megaphone-outline', color: '#B45309' },
  business: { name: 'briefcase-outline', color: Colors.brand.primary },
  ordinance: { name: 'hand-right-outline', color: '#7C3AED' },
  ministering: { name: 'heart-outline', color: '#DC2626' },
  follow_up: { name: 'arrow-redo-outline', color: '#0F766E' },
  note: { name: 'document-text-outline', color: Colors.brand.midGray },
  custom: { name: 'ellipsis-horizontal-circle-outline', color: Colors.brand.midGray },
};

const PERSON_CENTRIC_TYPES = new Set(['prayer', 'spiritual_thought', 'speaker']);

function getItemIcon(type: string) {
  return ITEM_ICONS[type] || { name: 'ellipsis-horizontal-outline', color: Colors.brand.midGray };
}

function getEntitySubtitle(entity: AgendaEntity | null | undefined, currentAgenda: AgendaSummaryListItem | null, pastCount: number) {
  if (!entity) return '';

  if (currentAgenda) {
    const prefix = currentAgenda.status === 'draft' ? 'Draft agenda' : 'Current agenda';
    return currentAgenda.meeting_date_label ? `${prefix} ${currentAgenda.meeting_date_label}` : prefix;
  }

  if (pastCount > 0) {
    return `${pastCount} past agenda${pastCount === 1 ? '' : 's'}`;
  }

  return `Agenda inbox for ${entity.entity_name}`;
}

function carryForwardTone(status: string) {
  if (status === 'waiting_for_report') {
    return { backgroundColor: '#FEF3C7', textColor: '#92400E' };
  }

  if (status === 'resolved') {
    return { backgroundColor: '#D1FAE5', textColor: '#065F46' };
  }

  return { backgroundColor: '#E8F4F8', textColor: Colors.brand.primary };
}

function buildAgendaBriefBullets(
  artifact?: AgendaSummary['leadership_intelligence'] extends { agenda_prep_brief?: infer T | null } ? T | null : never
): string[] {
  const payload = artifact?.payload as AgendaPrepBriefPayload | undefined;
  if (!payload) return [];

  const placementCandidates = Array.isArray(payload.placement_candidates) ? payload.placement_candidates : [];
  const watchItems = Array.isArray(payload.watch_items) ? payload.watch_items : [];

  return uniqueLeadershipLines([
    ...placementCandidates.flatMap((item) => [item.title, item.why_now, item.next_step]),
    ...watchItems.flatMap((item) => [item.title, item.detail, item.timing]),
  ], 3);
}

function AgendaItemRow({
  item,
  meetingDate,
  onOpenCarryForward,
}: {
  item: AgendaItemData;
  meetingDate?: string | null;
  onOpenCarryForward?: (carryForwardId: number, meetingDate?: string | null) => void;
}) {
  const icon = getItemIcon(item.item_type);
  const titleMatchesPresenter = item.title && item.presenter_name &&
    item.title.trim().toLowerCase() === item.presenter_name.trim().toLowerCase();
  const isPersonCentric = PERSON_CENTRIC_TYPES.has(item.item_type);

  let displayTitle: string;
  let displaySubtitle: string | null;

  if (titleMatchesPresenter || (isPersonCentric && !item.title)) {
    displayTitle = item.item_type_label;
    displaySubtitle = item.presenter_name || item.title || null;
  } else {
    displayTitle = item.title || item.item_type_label;
    displaySubtitle = item.presenter_name ?? null;
  }

  return (
    <View style={[itemS.row, item.is_mine && itemS.rowMine]}>
      {item.is_mine && <View style={itemS.mineStripe} />}
      <View style={[itemS.iconCircle, { backgroundColor: icon.color + '15' }]}>
        <Ionicons name={icon.name as any} size={16} color={icon.color} />
      </View>
      <View style={itemS.content}>
        <View style={itemS.titleRow}>
          <Text style={itemS.title} numberOfLines={2}>
            {displayTitle}
          </Text>
          {item.duration_minutes ? (
            <Text style={itemS.duration}>{item.duration_minutes} min</Text>
          ) : null}
        </View>
        {displaySubtitle ? (
          <Text style={itemS.presenter} numberOfLines={1}>
            {displaySubtitle}
          </Text>
        ) : null}
        {(item.is_mine || (item.item_type === 'hymn' && item.hymn_number)) ? (
          <View style={itemS.chipRow}>
            {item.is_mine ? (
              <View style={itemS.mineBadge}>
                <Text style={itemS.mineBadgeText}>Your assignment</Text>
              </View>
            ) : null}
            {item.item_type === 'hymn' && item.hymn_number ? (
              <Text style={itemS.duration}>#{item.hymn_number}</Text>
            ) : null}
          </View>
        ) : null}
        {item.carry_forward_context?.id && onOpenCarryForward ? (
          <Pressable
            onPress={() => onOpenCarryForward(item.carry_forward_context!.id, meetingDate)}
            style={({ pressed }) => [itemS.carryForwardLink, pressed && itemS.carryForwardLinkPressed]}
            accessibilityRole="button"
            testID={`agenda-item-carry-forward-${item.carry_forward_context.id}`}
          >
            <View style={itemS.carryForwardIcon}>
              <Ionicons name="refresh-outline" size={14} color="#0F766E" />
            </View>
            <View style={itemS.carryForwardCopy}>
              <Text style={itemS.carryForwardLabel}>Carry-Forward</Text>
              <Text style={itemS.carryForwardMeta} numberOfLines={2}>
                {item.carry_forward_context.current_status_label}
                {item.carry_forward_context.report_due_label ? ` · Report ${item.carry_forward_context.report_due_label}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.brand.midGray} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function SectionBlock({
  section,
  meetingDate,
  onOpenCarryForward,
  expanded,
  onToggle,
}: {
  section: AgendaSection;
  meetingDate?: string | null;
  onOpenCarryForward?: (carryForwardId: number, meetingDate?: string | null) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (section.items.length === 0) return null;

  return (
    <View style={secS.block}>
      <Pressable onPress={onToggle} style={secS.header} accessibilityRole="button">
        <Text style={secS.title}>{section.title}</Text>
        <View style={secS.countBadge}>
          <Text style={secS.countText}>{section.items.length}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.brand.midGray}
        />
      </Pressable>
      {expanded ? (
        <View style={secS.items}>
          {section.items.map((item) => (
            <AgendaItemRow
              key={item.id}
              item={item}
              meetingDate={meetingDate}
              onOpenCarryForward={onOpenCarryForward}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CarryForwardSurfaceCard({
  agenda,
  entityType,
  entityId,
  currentReturnTarget,
  onOpenCarryForward,
}: {
  agenda: AgendaSummary;
  entityType?: AgendaEntityType | null;
  entityId?: number | null;
  currentReturnTarget: string;
  onOpenCarryForward: (carryForwardId: number, meetingDate?: string | null) => void;
}) {
  const surface = agenda.carry_forward_context;

  if (!surface?.enabled || surface.groups.length === 0 || !entityType || !entityId) {
    return null;
  }

  return (
    <View style={surfaceS.card} testID="agenda-carry-forward-surface">
      <View style={surfaceS.header}>
        <View style={{ flex: 1 }}>
          <Text style={surfaceS.title}>Carry-Forward</Text>
          <Text style={surfaceS.subtitle}>
            {surface.auto_surface_count} surfaced item{surface.auto_surface_count === 1 ? '' : 's'}
            {surface.report_back_due_count > 0 ? ` · ${surface.report_back_due_count} report-back due` : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(withReturnTarget('/carry-forward', currentReturnTarget, {
              entityType,
              entityId,
            }));
          }}
          style={({ pressed }) => [surfaceS.openListButton, pressed && surfaceS.openListButtonPressed]}
          accessibilityRole="button"
          testID="agenda-carry-forward-list-btn"
        >
          <Text style={surfaceS.openListText}>Open entity list</Text>
        </Pressable>
      </View>

      <View style={surfaceS.groupWrap}>
        {surface.groups.map((group) => (
          <View key={group.key} style={surfaceS.groupCard}>
            <Text style={surfaceS.groupTitle}>{group.title}</Text>
            {group.items.map((item) => {
              const tone = carryForwardTone(item.current_status);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => onOpenCarryForward(item.id, agenda.meeting_date)}
                  style={({ pressed }) => [surfaceS.groupItem, pressed && surfaceS.groupItemPressed]}
                  accessibilityRole="button"
                  testID={`agenda-carry-forward-surface-item-${item.id}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={surfaceS.groupItemTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={surfaceS.groupItemMeta} numberOfLines={2}>
                      {item.report_due_label ? `Report ${item.report_due_label}` : item.next_review_label ? `Review ${item.next_review_label}` : 'Open continuity thread'}
                    </Text>
                    {item.linked_evidence_summary?.summary ? (
                      <Text style={surfaceS.groupItemSummary} numberOfLines={2}>
                        {item.linked_evidence_summary.summary}
                      </Text>
                    ) : null}
                  </View>
                  <View style={surfaceS.groupItemRight}>
                    <AppStatusBadge
                      label={item.current_status_label}
                      backgroundColor={tone.backgroundColor}
                      textColor={tone.textColor}
                    />
                    <Ionicons name="chevron-forward" size={16} color={Colors.brand.midGray} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function AgendaDetailCard({
  agenda,
  index,
  entityType,
  entityId,
  currentReturnTarget,
  onOpenCarryForward,
  initiallyExpanded = true,
  variant = 'standalone',
}: {
  agenda: AgendaSummary;
  index: number;
  entityType?: AgendaEntityType | null;
  entityId?: number | null;
  currentReturnTarget: string;
  onOpenCarryForward: (carryForwardId: number, meetingDate?: string | null) => void;
  initiallyExpanded?: boolean;
  variant?: 'standalone' | 'embedded';
}) {
  const [cardExpanded, setCardExpanded] = useState(initiallyExpanded);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    if (!initiallyExpanded) return {};

    const next: Record<string, boolean> = {};
    agenda.sections.forEach((section) => {
      next[section.key] = true;
    });
    return next;
  });

  useEffect(() => {
    if (!initiallyExpanded) return;

    const next: Record<string, boolean> = {};
    agenda.sections.forEach((section) => {
      next[section.key] = true;
    });
    setCardExpanded(true);
    setExpandedSections(next);
  }, [agenda.id, agenda.sections, initiallyExpanded]);

  const toggleCard = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setCardExpanded((prev) => {
      const next = !prev;
      if (next) {
        const nextSections: Record<string, boolean> = {};
        agenda.sections.forEach((section) => {
          nextSections[section.key] = true;
        });
        setExpandedSections(nextSections);
      }
      return next;
    });
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Animated.View entering={FadeInDown.duration(350).delay(80 + index * 40)}>
      <View style={[cardS.card, variant === 'embedded' && cardS.cardEmbedded]}>
        <Pressable onPress={toggleCard} style={cardS.cardHeader} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={cardS.cardTitle}>{agenda.title}</Text>
            <View style={cardS.metaRow}>
              {agenda.meeting_date_label ? (
                <View style={cardS.metaItem}>
                  <Ionicons name="calendar-outline" size={13} color={Colors.brand.midGray} />
                  <Text style={cardS.metaText}>{agenda.meeting_date_label}</Text>
                </View>
              ) : null}
              {agenda.meeting_time ? (
                <View style={cardS.metaItem}>
                  <Ionicons name="time-outline" size={13} color={Colors.brand.midGray} />
                  <Text style={cardS.metaText}>{agenda.meeting_time}</Text>
                </View>
              ) : null}
              <View style={cardS.metaItem}>
                <Ionicons name="list-outline" size={13} color={Colors.brand.midGray} />
                <Text style={cardS.metaText}>{agenda.item_count} items</Text>
              </View>
            </View>
            {agenda.location ? (
              <View style={cardS.metaItem}>
                <Ionicons name="location-outline" size={13} color={Colors.brand.midGray} />
                <Text style={cardS.metaText}>{agenda.location}</Text>
              </View>
            ) : null}
          </View>
          <View style={cardS.headerRight}>
            {agenda.my_item_count > 0 ? (
              <View style={cardS.myBadge}>
                <Text style={cardS.myBadgeText}>{agenda.my_item_count} yours</Text>
              </View>
            ) : null}
            <Ionicons name={cardExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.brand.midGray} />
          </View>
        </Pressable>

        {cardExpanded && agenda.sections.length > 0 ? (
          <View style={cardS.sectionsWrap}>
            <CarryForwardSurfaceCard
              agenda={agenda}
              entityType={entityType}
              entityId={entityId}
              currentReturnTarget={currentReturnTarget}
              onOpenCarryForward={onOpenCarryForward}
            />
            {agenda.sections.map((section) => (
              <SectionBlock
                key={section.key}
                section={section}
                meetingDate={agenda.meeting_date}
                onOpenCarryForward={onOpenCarryForward}
                expanded={!!expandedSections[section.key]}
                onToggle={() => toggleSection(section.key)}
              />
            ))}
          </View>
        ) : null}

        {cardExpanded && agenda.sections.every((section) => section.items.length === 0) ? (
          <View style={cardS.noItems}>
            <Text style={cardS.noItemsText}>No items in this published agenda yet.</Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default function AgendaEntityScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    entityType?: string | string[];
    entityId?: string | string[];
    agendaId?: string | string[];
    tab?: string | string[];
  }>();

  const paramEntityType = getSingleParam(params.entityType) as AgendaEntityType | undefined;
  const paramEntityId = Number(getSingleParam(params.entityId) || 0) || null;
  const paramAgendaId = Number(getSingleParam(params.agendaId) || 0) || null;
  const paramTab = getSingleParam(params.tab) === 'past' ? 'past' : getSingleParam(params.tab) === 'current' ? 'current' : null;

  const [activeTab, setActiveTab] = useState<AgendaTab>(paramTab ?? 'current');
  const [selectedAgendaId, setSelectedAgendaId] = useState<number | null>(paramAgendaId);

  const directEntityQuery = useAgendaEntity(paramEntityType, paramEntityId);
  const selectedAgendaQuery = usePublishedAgenda(selectedAgendaId);

  const derivedEntityType = directEntityQuery.data?.entity.entity_type
    ?? selectedAgendaQuery.data?.entity.entity_type
    ?? paramEntityType
    ?? null;
  const derivedEntityId = directEntityQuery.data?.entity.entity_id
    ?? selectedAgendaQuery.data?.entity.entity_id
    ?? paramEntityId
    ?? null;
  const currentReturnTarget = useMemo(() => buildPathWithParams('/agenda-entity', {
    entityType: derivedEntityType ?? undefined,
    entityId: derivedEntityId ?? undefined,
    agendaId: selectedAgendaId ?? undefined,
    tab: activeTab,
  }), [activeTab, derivedEntityId, derivedEntityType, selectedAgendaId]);

  const shouldUseDerivedEntityQuery = Boolean(
    derivedEntityType &&
    derivedEntityId &&
    (derivedEntityType !== paramEntityType || derivedEntityId !== paramEntityId)
  );

  const entityQuery = useAgendaEntity(
    shouldUseDerivedEntityQuery ? derivedEntityType : null,
    shouldUseDerivedEntityQuery ? derivedEntityId : null,
  );
  const entityResponse = entityQuery.data ?? directEntityQuery.data;
  const entity = entityResponse?.entity ?? selectedAgendaQuery.data?.entity;
  const currentAgenda = entityResponse?.current_agenda ?? null;
  const pastAgendas = useMemo(
    () => entityResponse?.past_agendas ?? [],
    [entityResponse?.past_agendas]
  );

  useEffect(() => {
    if (!entityResponse) return;

    if (paramAgendaId) {
      const isCurrentAgenda = entityResponse.current_agenda?.id === paramAgendaId;
      setActiveTab(isCurrentAgenda ? 'current' : 'past');
      setSelectedAgendaId(paramAgendaId);
      return;
    }

    if (paramTab) {
      setActiveTab(paramTab);
      if (paramTab === 'current' && entityResponse.current_agenda?.id) {
        setSelectedAgendaId(entityResponse.current_agenda.id);
      }
      if (paramTab === 'past' && entityResponse.past_agendas[0]?.id) {
        setSelectedAgendaId(entityResponse.past_agendas[0].id);
      }
      return;
    }

    if (entityResponse.current_agenda?.id) {
      setActiveTab('current');
      setSelectedAgendaId(entityResponse.current_agenda.id);
      return;
    }

    if (entityResponse.past_agendas[0]?.id) {
      setActiveTab('past');
      setSelectedAgendaId(entityResponse.past_agendas[0].id);
    }
  }, [entityResponse, paramAgendaId, paramTab]);

  const selectedPastAgenda = useMemo(
    () => pastAgendas.find((agenda) => agenda.id === selectedAgendaId) ?? pastAgendas[0] ?? null,
    [pastAgendas, selectedAgendaId]
  );

  const detailAgenda = selectedAgendaQuery.data?.agenda ?? null;
  const currentAgendaBrief = activeTab === 'current'
    ? detailAgenda?.leadership_intelligence?.agenda_prep_brief
      ?? currentAgenda?.leadership_intelligence?.agenda_prep_brief
      ?? null
    : null;
  const canQuickAddToCurrentDraft = Boolean(
    entity?.can_submit
      && currentAgenda?.status === 'draft'
      && currentAgenda?.id,
  );
  const segmentItems = useMemo(() => {
    const items = [];
    if (currentAgenda) items.push({ key: 'current', label: 'Current' });
    if (pastAgendas.length > 0) items.push({ key: 'past', label: `Past (${pastAgendas.length})` });
    return items;
  }, [currentAgenda, pastAgendas.length]);

  const canRefetchDirectEntity = Boolean(paramEntityType && paramEntityId);
  const canRefetchDerivedEntity = shouldUseDerivedEntityQuery;
  const canRefetchSelectedAgenda = Boolean(selectedAgendaId);
  const refetchDirectEntity = directEntityQuery.refetch;
  const refetchDerivedEntity = entityQuery.refetch;
  const refetchSelectedAgenda = selectedAgendaQuery.refetch;
  const isInitialLoading = (!entityResponse && !selectedAgendaQuery.data) || (paramAgendaId && !selectedAgendaQuery.data);
  const hasError =
    (canRefetchDirectEntity && directEntityQuery.isError) ||
    (canRefetchDerivedEntity && entityQuery.isError) ||
    selectedAgendaQuery.isError;
  const isRefreshing =
    (canRefetchDirectEntity && directEntityQuery.isRefetching) ||
    (canRefetchDerivedEntity && entityQuery.isRefetching) ||
    (canRefetchSelectedAgenda && selectedAgendaQuery.isRefetching);

  const handleOpenCarryForward = useCallback((carryForwardId: number, meetingDate?: string | null) => {
    if (!entity?.entity_type || !entity?.entity_id) {
      return;
    }

    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    router.push(withReturnTarget('/carry-forward-detail', currentReturnTarget, {
      itemId: carryForwardId,
      entityType: entity.entity_type,
      entityId: entity.entity_id,
      meetingDate: meetingDate ?? undefined,
      meetingInstanceKey: buildCarryForwardMeetingInstanceKey(entity.entity_type, entity.entity_id, meetingDate),
    }));
  }, [currentReturnTarget, entity?.entity_id, entity?.entity_type]);

  const handleRefresh = useCallback(async () => {
    triggerGlobalRefreshIndicator();

    await Promise.all([
      ...(canRefetchDirectEntity ? [refetchDirectEntity()] : []),
      ...(canRefetchDerivedEntity ? [refetchDerivedEntity()] : []),
      ...(canRefetchSelectedAgenda ? [refetchSelectedAgenda()] : []),
    ]);
  }, [
    canRefetchDirectEntity,
    canRefetchDerivedEntity,
    canRefetchSelectedAgenda,
    refetchDirectEntity,
    refetchDerivedEntity,
    refetchSelectedAgenda,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (canRefetchDirectEntity) {
        refetchDirectEntity();
      }
      if (canRefetchDerivedEntity) {
        refetchDerivedEntity();
      }
      if (canRefetchSelectedAgenda) {
        refetchSelectedAgenda();
      }
    }, [
      canRefetchDirectEntity,
      canRefetchDerivedEntity,
      canRefetchSelectedAgenda,
      refetchDirectEntity,
      refetchDerivedEntity,
      refetchSelectedAgenda,
    ])
  );

  if (isInitialLoading) {
    return (
      <View style={[screenS.container, screenS.centered]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={screenS.loadingText}>Loading agenda...</Text>
      </View>
    );
  }

  if (hasError || !entity) {
    return (
      <View style={[screenS.container, screenS.centered]}>
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.brand.error} />
        <Text style={screenS.errorTitle}>Unable to load this agenda</Text>
        <Text style={screenS.errorDesc}>Tap Retry to load the latest agenda details for this meeting.</Text>
        <Pressable onPress={() => handleRefresh()} style={screenS.retryBtn}>
          <Text style={screenS.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={screenS.container}>
      <Stack.Screen
        options={{
          title: entity.entity_name,
          headerRight: () => (
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(withReturnTarget(
                  '/agenda-submit',
                  currentReturnTarget,
                  entity.can_submit
                    ? {
                        entityType: entity.entity_type,
                        entityId: entity.entity_id,
                      }
                    : undefined,
                ));
              }}
              style={{ padding: 6 }}
              testID="agenda-submit-header-btn"
            >
              <Ionicons name="add-circle-outline" size={24} color={Colors.brand.white} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={screenS.scroll}
        contentContainerStyle={[screenS.scrollContent, { paddingBottom: insets.bottom + WEB_BOTTOM_INSET + 28 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.brand.primary}
          />
        }
      >
        <View style={screenS.contentWrap}>
          <Animated.View entering={FadeIn.duration(260)}>
            <View style={screenS.workspaceCard}>
              <View style={screenS.workspaceHeader}>
                <View style={screenS.workspaceHeaderMain}>
                  <Text style={screenS.workspaceEyebrow}>Agenda</Text>
                  <Text style={screenS.workspaceTitle}>{entity.entity_name}</Text>
                  <Text style={screenS.workspaceSubtitle}>
                    {getEntitySubtitle(entity, currentAgenda, pastAgendas.length)}
                  </Text>
                </View>
                {currentAgenda ? (
                  <View style={[
                    screenS.statusBadge,
                    currentAgenda.status === 'draft' ? screenS.statusBadgeDraft : screenS.statusBadgePublished,
                  ]}>
                    <Text style={[
                      screenS.statusBadgeText,
                      currentAgenda.status === 'draft' ? screenS.statusBadgeTextDraft : screenS.statusBadgeTextPublished,
                    ]}>
                      {currentAgenda.status === 'draft' ? 'Draft' : 'Published'}
                    </Text>
                  </View>
                ) : null}
              </View>
              {segmentItems.length > 1 ? (
                <AppSegmentedControl
                  items={segmentItems}
                  activeKey={activeTab}
                  onChange={(nextKey) => {
                    const nextTab = nextKey as AgendaTab;
                    setActiveTab(nextTab);
                    if (nextTab === 'current' && currentAgenda?.id) {
                      setSelectedAgendaId(currentAgenda.id);
                    }
                    if (nextTab === 'past' && selectedPastAgenda?.id) {
                      setSelectedAgendaId(selectedPastAgenda.id);
                    }
                  }}
                  style={screenS.segmented}
                  testIDPrefix="agenda-tab"
                />
              ) : null}

              {activeTab === 'current' ? (
                currentAgenda ? (
                  <View style={screenS.workspaceBody}>
                    {currentAgendaBrief ? (
                      <PreparedLeadershipCard
                        eyebrow={currentAgendaBrief.context_label ?? 'Prepared meeting brief'}
                        title={currentAgendaBrief.title}
                        summary={currentAgendaBrief.summary_sentence || currentAgendaBrief.payload.summary_sentence || 'This draft already has a prepared meeting read.'}
                        question={currentAgendaBrief.payload.opening_question}
                        focus={currentAgendaBrief.payload.meeting_focus}
                        bullets={buildAgendaBriefBullets(currentAgendaBrief)}
                        note={currentAgendaBrief.payload.continuity_watch || currentAgendaBrief.payload.publish_watch || undefined}
                        generatedLabel={currentAgendaBrief.generated_label}
                        statusLabel={currentAgendaBrief.status_label}
                        statusTone={currentAgendaBrief.status_tone}
                        icon="clipboard-outline"
                        testID="agenda-entity-prepared-brief"
                      />
                    ) : null}

                    {canQuickAddToCurrentDraft ? (
                      <Pressable
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          router.push(withReturnTarget('/agenda-submit', currentReturnTarget, {
                            entityType: entity.entity_type,
                            entityId: entity.entity_id,
                            agendaId: currentAgenda.id,
                            mode: 'specific',
                          }));
                        }}
                        style={({ pressed }) => [
                          screenS.quickAddButton,
                          pressed && screenS.quickAddButtonPressed,
                        ]}
                        accessibilityRole="button"
                        testID="agenda-current-quick-add-btn"
                      >
                        <View style={screenS.quickAddIcon}>
                          <Ionicons name="add" size={16} color={Colors.brand.primary} />
                        </View>
                        <View style={screenS.quickAddCopy}>
                          <Text style={screenS.quickAddTitle}>Add to this draft</Text>
                          <Text style={screenS.quickAddSubtitle}>Use the live sections from this meeting right now.</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
                      </Pressable>
                    ) : null}

                    {selectedAgendaQuery.isLoading && currentAgenda.id === selectedAgendaId ? (
                      <View style={screenS.inlineLoading}>
                        <ActivityIndicator size="small" color={Colors.brand.primary} />
                        <Text style={screenS.inlineLoadingText}>Loading current agenda...</Text>
                      </View>
                    ) : null}

                    {detailAgenda && detailAgenda.id === currentAgenda.id ? (
                      <AgendaDetailCard
                        agenda={detailAgenda}
                        index={0}
                        entityType={entity.entity_type}
                        entityId={entity.entity_id}
                        currentReturnTarget={currentReturnTarget}
                        onOpenCarryForward={handleOpenCarryForward}
                        variant="embedded"
                      />
                    ) : null}
                  </View>
                ) : (
                  <View style={screenS.emptyState}>
                    <View style={screenS.emptyIcon}>
                      <MaterialCommunityIcons name="calendar-clock-outline" size={36} color={Colors.brand.primary} />
                    </View>
                    <Text style={screenS.emptyTitle}>No current agenda yet</Text>
                    <Text style={screenS.emptyDesc}>
                      {pastAgendas.length > 0
                        ? 'Open the Past tab to review earlier meetings. Use the + button to send something into the Meeting Inbox.'
                        : 'Use the + button to send something into the Meeting Inbox while the next meeting is still being prepared.'}
                    </Text>
                  </View>
                )
              ) : (
                <View style={screenS.workspaceBody}>
                  {pastAgendas.length > 0 ? (
                    <View style={screenS.pastListWrap}>
                      {pastAgendas.map((agenda, index) => {
                        const selected = agenda.id === (selectedPastAgenda?.id ?? selectedAgendaId);

                        return (
                          <View key={agenda.id}>
                            <AppListRow
                              title={agenda.meeting_date_label || agenda.title}
                              subtitle={`${agenda.title}${agenda.item_count ? ` · ${agenda.item_count} items` : ''}`}
                              left={(
                                <View style={[screenS.listIcon, selected && screenS.listIconSelected]}>
                                  <Ionicons name="calendar-outline" size={18} color={selected ? Colors.brand.white : Colors.brand.primary} />
                                </View>
                              )}
                              right={
                                selected
                                  ? <Text style={screenS.selectedText}>Viewing</Text>
                                  : <Ionicons name="chevron-forward" size={17} color={Colors.brand.midGray} />
                              }
                              onPress={() => {
                                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setSelectedAgendaId(agenda.id);
                              }}
                              testID={`past-agenda-${agenda.id}`}
                            />
                            {index < pastAgendas.length - 1 ? <View style={screenS.listDivider} /> : null}
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={screenS.emptyState}>
                      <View style={screenS.emptyIcon}>
                        <MaterialCommunityIcons name="history" size={36} color={Colors.brand.primary} />
                      </View>
                      <Text style={screenS.emptyTitle}>No past agendas yet</Text>
                      <Text style={screenS.emptyDesc}>Older meetings will appear here after they pass.</Text>
                    </View>
                  )}

                  {selectedPastAgenda ? (
                    <>
                      {selectedAgendaQuery.isLoading && selectedPastAgenda.id === selectedAgendaId ? (
                        <View style={screenS.inlineLoading}>
                          <ActivityIndicator size="small" color={Colors.brand.primary} />
                          <Text style={screenS.inlineLoadingText}>Loading selected agenda...</Text>
                        </View>
                      ) : null}

                      {detailAgenda && detailAgenda.id === selectedPastAgenda.id ? (
                        <AgendaDetailCard
                          agenda={detailAgenda}
                          index={1}
                          entityType={entity.entity_type}
                          entityId={entity.entity_id}
                          currentReturnTarget={currentReturnTarget}
                          onOpenCarryForward={handleOpenCarryForward}
                          variant="embedded"
                        />
                      ) : null}
                    </>
                  ) : null}
                </View>
              )}
              <Text style={screenS.footerHint}>
                {canQuickAddToCurrentDraft
                  ? 'Use the small Add button for this draft, or use the header + to choose any meeting inbox you can access.'
                  : 'Use the + button in the header to submit a topic to any meeting inbox you can access.'}
              </Text>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const screenS = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 15, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },
  errorTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold', color: Colors.brand.black, marginTop: 16 },
  errorDesc: { fontSize: 15, color: Colors.brand.darkGray, marginTop: 6, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  retryBtn: { marginTop: 20, backgroundColor: Colors.brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 15, color: Colors.brand.white, fontFamily: 'Inter_600SemiBold' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8 },
  contentWrap: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 20 },
  workspaceCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 20,
    padding: 18,
    marginTop: 8,
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 3, 10),
    elevation: 3,
  },
  workspaceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'flex-start',
  },
  workspaceHeaderMain: { flex: 1 },
  workspaceEyebrow: {
    fontSize: 12,
    color: Colors.brand.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Inter_700Bold',
  },
  workspaceTitle: { marginTop: 6, fontSize: 22, color: Colors.brand.black, fontFamily: 'Inter_700Bold' },
  workspaceSubtitle: { marginTop: 4, fontSize: 15, lineHeight: 21, color: Colors.brand.darkGray, fontFamily: 'Inter_400Regular' },
  workspaceBody: { marginTop: 14, gap: 14 },
  segmented: { marginBottom: 14 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeDraft: { backgroundColor: '#FEF3C7' },
  statusBadgePublished: { backgroundColor: '#E8F8F0' },
  statusBadgeText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  statusBadgeTextDraft: { color: '#B45309' },
  statusBadgeTextPublished: { color: '#0F766E' },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  quickAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    backgroundColor: Colors.brand.sectionBg,
  },
  quickAddButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  quickAddIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.primary + '14',
  },
  quickAddCopy: {
    flex: 1,
  },
  quickAddTitle: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  quickAddSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  inlineLoadingText: { fontSize: 14, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },
  emptyState: { alignItems: 'center', paddingTop: 52, paddingHorizontal: 20 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 20, color: Colors.brand.black, marginBottom: 6, fontFamily: 'Inter_600SemiBold' },
  emptyDesc: { fontSize: 15, color: Colors.brand.darkGray, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  pastListWrap: {
    backgroundColor: Colors.brand.sectionBg,
    borderRadius: 16,
    overflow: 'hidden',
  },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.brand.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listIconSelected: {
    backgroundColor: Colors.brand.primary,
  },
  listDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.brand.lightGray,
    marginLeft: 68,
  },
  selectedText: {
    fontSize: 13,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  footerHint: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
});

const surfaceS = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontSize: 16,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  openListButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.brand.sectionBg,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
  },
  openListButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  openListText: {
    fontSize: 13,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  groupWrap: {
    gap: 10,
  },
  groupCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    overflow: 'hidden',
  },
  groupTitle: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.brand.sectionBg,
    fontSize: 13,
    color: Colors.brand.darkGray,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: 'Inter_600SemiBold',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.brand.inputBorder,
  },
  groupItemPressed: {
    backgroundColor: Colors.brand.offWhite,
  },
  groupItemTitle: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  groupItemMeta: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  groupItemSummary: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  groupItemRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
});

const cardS = StyleSheet.create({
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 3, 10),
    elevation: 3,
  },
  cardEmbedded: {
    marginBottom: 0,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    borderRadius: 16,
    shadowColor: 'transparent',
    elevation: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 19,
    color: Colors.brand.black,
    marginBottom: 6,
    fontFamily: 'Inter_700Bold',
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 15, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },
  headerRight: { alignItems: 'flex-end', gap: 6 },
  myBadge: { backgroundColor: Colors.brand.primary + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  myBadgeText: { fontSize: 14, color: Colors.brand.primary, fontFamily: 'Inter_600SemiBold' },
  sectionsWrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.brand.lightGray, paddingBottom: 4 },
  noItems: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.brand.lightGray },
  noItemsText: { fontSize: 15, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});

const secS = StyleSheet.create({
  block: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.brand.lightGray },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  title: { flex: 1, fontSize: 15, color: Colors.brand.darkGray, textTransform: 'uppercase', letterSpacing: 0.4, fontFamily: 'Inter_600SemiBold' },
  countBadge: { backgroundColor: Colors.brand.sectionBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  countText: { fontSize: 13, color: Colors.brand.midGray, fontFamily: 'Inter_600SemiBold' },
  items: { paddingBottom: 6 },
});

const itemS = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  rowMine: {
    backgroundColor: '#DBEAFE',
  },
  mineStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#1E40AF',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: { flex: 1, fontSize: 16, color: Colors.brand.dark, fontFamily: 'Inter_500Medium', lineHeight: 22 },
  presenter: { fontSize: 15, color: Colors.brand.darkGray, fontFamily: 'Inter_400Regular', marginTop: 2 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  mineBadge: { backgroundColor: '#1E40AF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  mineBadgeText: { fontSize: 13, color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  duration: { fontSize: 14, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },
  carryForwardLink: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    backgroundColor: Colors.brand.sectionBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  carryForwardLinkPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  carryForwardIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F8F0',
  },
  carryForwardCopy: {
    flex: 1,
  },
  carryForwardLabel: {
    fontSize: 13,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  carryForwardMeta: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
});
