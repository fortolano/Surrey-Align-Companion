import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { getApiUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';

interface ActionItem {
  id: number;
  title: string;
  status: string;
  progress_percent: number;
  due_on: string | null;
  notes: string | null;
}

interface ProgressIndicator {
  id: number;
  title: string;
  status: string;
  progress: number;
  sign_type: string;
  start_value: number;
  target_value: number;
  current_value: number;
  unit: string | null;
  owner: string;
  owner_id: number;
  actions: ActionItem[];
  action_summary: { total: number; completed: number; avg_progress: number };
}

interface ExecutionEntity {
  type: string;
  id: number;
  name: string;
  ward: string | null;
  progress_indicators?: ProgressIndicator[];
  pi_count?: number;
  pi_completed_count?: number;
  avg_progress?: number;
}

interface GoalDetail {
  id: number;
  title: string;
  scope: string;
  status: string;
  progress: number;
  description: string;
  align_reflection: string | null;
  focus_area: string;
  created_by: string;
}

interface ExecutionResponse {
  success: boolean;
  goal: GoalDetail;
  entities: ExecutionEntity[];
  meta: {
    entity_count: number;
    total_pis: number;
    includes_actions: boolean;
  };
}

function scopeColor(scope: string): string {
  switch (scope) {
    case 'stake': return '#016183';
    case 'ward': return '#0F766E';
    case 'organization': return '#7C3AED';
    case 'committee': return '#D97706';
    default: return Colors.brand.midGray;
  }
}

function piStatusIcon(status: string): { name: string; color: string } {
  switch (status) {
    case 'completed': return { name: 'checkmark-circle', color: Colors.brand.success };
    case 'in_progress': return { name: 'time-outline', color: Colors.brand.primary };
    case 'not_started': return { name: 'ellipse-outline', color: Colors.brand.midGray };
    default: return { name: 'ellipse-outline', color: Colors.brand.midGray };
  }
}

function actionStatusIcon(status: string): { name: string; color: string } {
  switch (status) {
    case 'completed': return { name: 'check-circle', color: Colors.brand.success };
    case 'in_progress': return { name: 'clock', color: Colors.brand.warning };
    case 'not_started': return { name: 'circle', color: Colors.brand.midGray };
    default: return { name: 'circle', color: Colors.brand.midGray };
  }
}

function ProgressBar({ progress, color, height = 6 }: { progress: number; color: string; height?: number }) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <View style={[pbStyles.track, { height }]}>
      <View style={[pbStyles.fill, { width: `${clamped}%`, backgroundColor: color, height }]} />
    </View>
  );
}

const pbStyles = StyleSheet.create({
  track: { backgroundColor: Colors.brand.lightGray, borderRadius: 3, overflow: 'hidden' },
  fill: { borderRadius: 3 },
});

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function ActionRow({ action }: { action: ActionItem }) {
  const icon = actionStatusIcon(action.status);
  const isOverdue = action.due_on && new Date(action.due_on) < new Date() && action.status !== 'completed';

  return (
    <View style={styles.actionRow}>
      <Feather name={icon.name as any} size={16} color={icon.color} />
      <View style={styles.actionContent}>
        <Text style={styles.actionTitle} numberOfLines={2}>{action.title}</Text>
        <View style={styles.actionMeta}>
          {action.due_on ? (
            <Text style={[styles.actionDue, isOverdue && styles.actionOverdue]}>
              {isOverdue ? 'Overdue' : ''} {formatDate(action.due_on)}
            </Text>
          ) : null}
          <Text style={styles.actionProgress}>{Math.round(action.progress_percent)}%</Text>
        </View>
        {action.notes ? (
          <Text style={styles.actionNotes} numberOfLines={1}>{action.notes}</Text>
        ) : null}
      </View>
    </View>
  );
}

function PICard({ pi, entityColor }: { pi: ProgressIndicator; entityColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const statusIcon = piStatusIcon(pi.status);
  const hasActions = pi.actions && pi.actions.length > 0;

  return (
    <View style={styles.piCard}>
      <Pressable
        onPress={() => hasActions && setExpanded(!expanded)}
        style={styles.piHeader}
      >
        <Ionicons name={statusIcon.name as any} size={20} color={statusIcon.color} />
        <View style={styles.piHeaderContent}>
          <Text style={styles.piTitle} numberOfLines={2}>{pi.title}</Text>
          <View style={styles.piMetaRow}>
            <Text style={styles.piOwner}>{pi.owner}</Text>
            <View style={styles.piValuePill}>
              <Text style={styles.piValueText}>
                {pi.current_value}/{pi.target_value}
                {pi.unit ? ` ${pi.unit}` : ''}
              </Text>
            </View>
          </View>
        </View>
        {hasActions && (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.brand.midGray}
          />
        )}
      </Pressable>

      <View style={styles.piProgressRow}>
        <ProgressBar progress={pi.progress} color={entityColor} height={5} />
        <Text style={styles.piPercent}>{Math.round(pi.progress)}%</Text>
      </View>

      {pi.action_summary && pi.action_summary.total > 0 && (
        <View style={styles.piSummaryRow}>
          <Feather name="check-circle" size={12} color={Colors.brand.success} />
          <Text style={styles.piSummaryText}>
            {pi.action_summary.completed}/{pi.action_summary.total} actions complete
          </Text>
        </View>
      )}

      {expanded && hasActions && (
        <View style={styles.actionsContainer}>
          {pi.actions.map((action) => (
            <ActionRow key={action.id} action={action} />
          ))}
        </View>
      )}
    </View>
  );
}

function entityTypeColor(type: string): string {
  switch (type) {
    case 'organization': return '#7C3AED';
    case 'council': return '#D97706';
    case 'committee': return '#0F766E';
    default: return Colors.brand.primary;
  }
}

function EntitySection({
  entity,
  index,
  isSummaryView,
  onDrillDown,
}: {
  entity: ExecutionEntity;
  index: number;
  isSummaryView: boolean;
  onDrillDown?: (entityType: string, entityId: number) => void;
}) {
  const color = entityTypeColor(entity.type);
  const hasPIs = entity.progress_indicators && entity.progress_indicators.length > 0;
  const isSummaryMode = !hasPIs && entity.pi_count !== undefined;

  const content = (
    <View style={styles.entitySection}>
      <View style={styles.entityHeader}>
        <View style={[styles.entityDot, { backgroundColor: color }]} />
        <View style={styles.entityHeaderText}>
          <Text style={styles.entityName} numberOfLines={1}>{entity.name}</Text>
          <View style={styles.entitySubRow}>
            {entity.ward && (
              <Text style={styles.entityWard}>{entity.ward}</Text>
            )}
            <Text style={styles.entityType}>
              {entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}
            </Text>
          </View>
        </View>
        {isSummaryMode && entity.avg_progress !== undefined && (
          <View style={styles.entityAvgBadge}>
            <Text style={styles.entityAvgText}>{Math.round(entity.avg_progress)}%</Text>
          </View>
        )}
        {isSummaryView && (
          <Ionicons name="chevron-forward" size={18} color={Colors.brand.midGray} />
        )}
      </View>

      {isSummaryMode ? (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            {entity.pi_completed_count}/{entity.pi_count} indicators complete
          </Text>
          <ProgressBar progress={entity.avg_progress || 0} color={color} />
        </View>
      ) : hasPIs ? (
        <View style={styles.piList}>
          {entity.progress_indicators!.map((pi) => (
            <PICard key={pi.id} pi={pi} entityColor={color} />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <Animated.View entering={FadeInDown.duration(300).delay(60 + index * 40)}>
      {isSummaryView && onDrillDown ? (
        <Pressable
          onPress={() => onDrillDown(entity.type, entity.id)}
          style={({ pressed }) => pressed ? { opacity: 0.85 } : undefined}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
    </Animated.View>
  );
}

export default function GoalDetailScreen() {
  const insets = useSafeAreaInsets();
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const { token } = useAuth();
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;
  const [drillDown, setDrillDown] = useState<{ entityType: string; entityId: number } | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<ExecutionResponse>({
    queryKey: ['/api/goals', goalId, 'execution'],
    queryFn: async () => {
      const base = getApiUrl();
      const url = `${base}api/goals/${goalId}/execution`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      if (res.status === 403) throw new Error('access_denied');
      if (!res.ok) throw new Error('Failed to load goal details');
      return res.json();
    },
    enabled: !!token && !!goalId,
    staleTime: 60000,
  });

  const { data: drillDownData, isLoading: drillDownLoading } = useQuery<ExecutionResponse>({
    queryKey: ['/api/goals', goalId, 'execution', drillDown?.entityType, drillDown?.entityId],
    queryFn: async () => {
      if (!drillDown) throw new Error('No drill down');
      const base = getApiUrl();
      const url = `${base}api/goals/${goalId}/execution?entity_type=${drillDown.entityType}&entity_id=${drillDown.entityId}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      if (!res.ok) throw new Error('Failed to load entity detail');
      return res.json();
    },
    enabled: !!token && !!goalId && !!drillDown,
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={styles.loadingText}>Loading goal details...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed-outline" size={40} color={Colors.brand.error} />
          <Text style={styles.errorTitle}>Unable to load</Text>
          <Text style={styles.errorDescription}>
            You may not have access to this goal, or something went wrong.
          </Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const goal = data?.goal;
  const entities = data?.entities || [];
  const meta = data?.meta;
  if (!goal) return null;

  const sColor = scopeColor(goal.scope);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + webBottomInset + 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brand.primary} />
      }
    >
      <Animated.View entering={FadeIn.duration(350)}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={[styles.heroBadge, { backgroundColor: sColor + '18' }]}>
              <Text style={[styles.heroBadgeText, { color: sColor }]}>
                {goal.scope.charAt(0).toUpperCase() + goal.scope.slice(1)}
              </Text>
            </View>
            <View style={[styles.heroStatusPill, { backgroundColor: Colors.brand.success + '18' }]}>
              <View style={[styles.heroStatusDot, { backgroundColor: Colors.brand.success }]} />
              <Text style={[styles.heroStatusText, { color: Colors.brand.success }]}>
                {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{goal.title}</Text>

          {goal.focus_area ? (
            <View style={styles.heroFocus}>
              <Ionicons name="leaf-outline" size={14} color={Colors.brand.midGray} />
              <Text style={styles.heroFocusText}>{goal.focus_area}</Text>
            </View>
          ) : null}

          <View style={styles.heroProgress}>
            <View style={styles.heroProgressHeader}>
              <Text style={styles.heroProgressLabel}>Overall Progress</Text>
              <Text style={styles.heroProgressValue}>{Math.round(goal.progress)}%</Text>
            </View>
            <ProgressBar progress={goal.progress} color={sColor} height={8} />
          </View>

          {goal.description ? (
            <Text style={styles.heroDesc}>{goal.description}</Text>
          ) : null}

          {goal.align_reflection ? (
            <View style={styles.reflectionBox}>
              <Ionicons name="bulb-outline" size={16} color={Colors.brand.primary} />
              <Text style={styles.reflectionText}>{goal.align_reflection}</Text>
            </View>
          ) : null}

          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}>
              <Ionicons name="person-outline" size={14} color={Colors.brand.midGray} />
              <Text style={styles.heroMetaText}>{goal.created_by}</Text>
            </View>
            {meta && (
              <View style={styles.heroMetaItem}>
                <MaterialCommunityIcons name="office-building-outline" size={14} color={Colors.brand.midGray} />
                <Text style={styles.heroMetaText}>{meta.entity_count} entities</Text>
              </View>
            )}
            {meta && (
              <View style={styles.heroMetaItem}>
                <MaterialCommunityIcons name="flag-checkered" size={14} color={Colors.brand.midGray} />
                <Text style={styles.heroMetaText}>{meta.total_pis} indicators</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      {drillDown && drillDownLoading && (
        <View style={styles.drillDownLoading}>
          <ActivityIndicator size="small" color={Colors.brand.primary} />
          <Text style={styles.loadingText}>Loading entity details...</Text>
        </View>
      )}

      {drillDown && drillDownData && drillDownData.entities.length > 0 && (
        <View style={styles.entitiesSection}>
          <View style={styles.drillDownHeader}>
            <Pressable onPress={() => setDrillDown(null)} style={styles.backToSummary}>
              <Ionicons name="arrow-back" size={16} color={Colors.brand.primary} />
              <Text style={styles.backToSummaryText}>Back to all entities</Text>
            </Pressable>
          </View>
          {drillDownData.entities.map((entity, index) => (
            <EntitySection
              key={`${entity.type}-${entity.id}`}
              entity={entity}
              index={index}
              isSummaryView={false}
            />
          ))}
        </View>
      )}

      {!drillDown && entities.length > 0 && (
        <View style={styles.entitiesSection}>
          <Text style={styles.sectionLabel}>
            {meta?.includes_actions ? 'Execution Details' : 'Summary by Entity'}
          </Text>
          {meta?.includes_actions === false && (
            <Text style={styles.summaryHint}>Tap an entity to see full details</Text>
          )}
          {entities.map((entity, index) => (
            <EntitySection
              key={`${entity.type}-${entity.id}`}
              entity={entity}
              index={index}
              isSummaryView={!meta?.includes_actions}
              onDrillDown={(entityType, entityId) => setDrillDown({ entityType, entityId })}
            />
          ))}
        </View>
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  errorContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.brand.black,
    marginTop: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  errorDescription: {
    fontSize: 14,
    color: Colors.brand.darkGray,
    marginTop: 6,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.brand.white,
    fontFamily: 'Inter_600SemiBold',
  },
  heroCard: {
    margin: 20,
    backgroundColor: Colors.brand.white,
    borderRadius: 20,
    padding: 22,
    shadowColor: Colors.light.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    fontFamily: 'Inter_600SemiBold',
  },
  heroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroStatusText: {
    fontSize: 11,
    fontWeight: '600' as const,
    fontFamily: 'Inter_600SemiBold',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.brand.black,
    lineHeight: 26,
    marginBottom: 8,
    fontFamily: 'Inter_700Bold',
  },
  heroFocus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
  },
  heroFocusText: {
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  heroProgress: {
    marginBottom: 18,
  },
  heroProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroProgressLabel: {
    fontSize: 13,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_500Medium',
  },
  heroProgressValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.brand.black,
    fontFamily: 'Inter_700Bold',
  },
  heroDesc: {
    fontSize: 14,
    color: Colors.brand.darkGray,
    lineHeight: 20,
    marginBottom: 14,
    fontFamily: 'Inter_400Regular',
  },
  reflectionBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.brand.accent,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  reflectionText: {
    flex: 1,
    fontSize: 13,
    color: Colors.brand.primary,
    lineHeight: 19,
    fontStyle: 'italic',
    fontFamily: 'Inter_400Regular',
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.brand.lightGray,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroMetaText: {
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  drillDownLoading: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  drillDownHeader: {
    marginBottom: 12,
  },
  backToSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backToSummaryText: {
    fontSize: 14,
    color: Colors.brand.primary,
    fontFamily: 'Inter_500Medium',
  },
  summaryHint: {
    fontSize: 12,
    color: Colors.brand.midGray,
    marginBottom: 10,
    fontFamily: 'Inter_400Regular',
  },
  entitiesSection: {
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.brand.midGray,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  entitySection: {
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: Colors.light.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  entityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  entityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  entityHeaderText: {
    flex: 1,
  },
  entityName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.brand.black,
    fontFamily: 'Inter_600SemiBold',
  },
  entitySubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  entityWard: {
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  entityType: {
    fontSize: 11,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
  },
  entityAvgBadge: {
    backgroundColor: Colors.brand.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  entityAvgText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.brand.primary,
    fontFamily: 'Inter_700Bold',
  },
  summaryRow: {
    gap: 8,
  },
  summaryText: {
    fontSize: 13,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  piList: {
    gap: 10,
  },
  piCard: {
    backgroundColor: Colors.brand.offWhite,
    borderRadius: 12,
    padding: 14,
  },
  piHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  piHeaderContent: {
    flex: 1,
  },
  piTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.brand.black,
    lineHeight: 19,
    fontFamily: 'Inter_600SemiBold',
  },
  piMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  piOwner: {
    fontSize: 12,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  piValuePill: {
    backgroundColor: Colors.brand.lightGray,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  piValueText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_600SemiBold',
  },
  piProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  piPercent: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.brand.darkGray,
    width: 32,
    textAlign: 'right',
    fontFamily: 'Inter_600SemiBold',
  },
  piSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  piSummaryText: {
    fontSize: 11,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  actionsContainer: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.brand.lightGray,
    paddingTop: 10,
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingLeft: 4,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 13,
    color: Colors.brand.black,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
  },
  actionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 3,
  },
  actionDue: {
    fontSize: 11,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  actionOverdue: {
    color: Colors.brand.error,
    fontWeight: '600' as const,
  },
  actionProgress: {
    fontSize: 11,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  actionNotes: {
    fontSize: 11,
    color: Colors.brand.midGray,
    fontStyle: 'italic',
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
});
