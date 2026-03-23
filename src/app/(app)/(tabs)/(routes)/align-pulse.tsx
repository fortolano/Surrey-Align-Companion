import React from 'react';
import { webShadowRgba } from '@/lib/web-styles';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import AppButton from '@/components/ui/AppButton';
import {
  useAlignPulseReport,
  type PulseAttentionItem,
  type PulseHealthLetter,
  type PulseWardRow,
  type PulseSupportRequest,
} from '@/lib/pulse-api';

// ─── Color helpers ─────────────────────────

const CONF_COLORS = {
  high: '#16a34a',
  medium: '#eab308',
  low: '#dc2626',
} as const;

function healthLetterBg(color: string): string {
  switch (color) {
    case 'success': return '#16a34a';
    case 'warning': return '#eab308';
    case 'orange': return '#ea580c';
    case 'danger': return '#dc2626';
    default: return Colors.brand.midGray;
  }
}

function trendDeltaColor(delta: number, inverted = false): string {
  if (delta === 0) return Colors.brand.midGray;
  const positive = inverted ? delta < 0 : delta > 0;
  return positive ? '#16a34a' : '#dc2626';
}

function formatDelta(d: number): string {
  return d > 0 ? `+${d}` : String(d);
}

// ─── Sub-components ────────────────────────

function StatCard({ value, label, color, delta, invertDelta, index }: {
  value: string | number;
  label: string;
  color: string;
  delta?: number;
  invertDelta?: boolean;
  index: number;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(300).delay(60 + index * 50)} style={s.statCard}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <View style={s.statLabelRow}>
        <Text style={s.statLabel}>{label}</Text>
        {delta !== undefined && delta !== 0 && (
          <View style={[s.deltaBadge, { backgroundColor: trendDeltaColor(delta, invertDelta) + '18' }]}>
            <Text style={[s.deltaText, { color: trendDeltaColor(delta, invertDelta) }]}>
              {formatDelta(delta)}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function ConfidenceBar({ high, medium, low, total }: { high: number; medium: number; low: number; total: number }) {
  if (total === 0) return null;
  const hPct = Math.round((high / total) * 100);
  const mPct = Math.round((medium / total) * 100);
  const lPct = Math.round((low / total) * 100);

  return (
    <View style={s.confBarOuter}>
      {hPct > 0 && (
        <View style={[s.confBarSeg, { width: `${hPct}%`, backgroundColor: CONF_COLORS.high }]}>
          {hPct >= 12 && <Text style={s.confBarNum}>{high}</Text>}
        </View>
      )}
      {mPct > 0 && (
        <View style={[s.confBarSeg, { width: `${mPct}%`, backgroundColor: CONF_COLORS.medium }]}>
          {mPct >= 12 && <Text style={[s.confBarNum, { color: '#1f2937' }]}>{medium}</Text>}
        </View>
      )}
      {lPct > 0 && (
        <View style={[s.confBarSeg, { width: `${lPct}%`, backgroundColor: CONF_COLORS.low }]}>
          {lPct >= 12 && <Text style={s.confBarNum}>{low}</Text>}
        </View>
      )}
    </View>
  );
}

function HealthLetterDots({ letters }: { letters: PulseHealthLetter[] }) {
  return (
    <View style={s.healthRow}>
      {letters.map((l) => (
        <View key={l.letter} style={[s.healthDot, { backgroundColor: healthLetterBg(l.color) }]}>
          <Text style={s.healthDotText}>{l.letter}</Text>
        </View>
      ))}
    </View>
  );
}

function ConfidenceHistoryDots({ history }: { history: NonNullable<PulseAttentionItem['confidence_history']> }) {
  const reversed = [...history].reverse();
  return (
    <View style={s.historyRow}>
      {reversed.map((h, i) => (
        <View key={i} style={[s.historyDot, { backgroundColor: CONF_COLORS[h.confidence as keyof typeof CONF_COLORS] + '25' }]}>
          <Text style={[s.historyDotText, { color: CONF_COLORS[h.confidence as keyof typeof CONF_COLORS] }]}>
            {h.month_label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function AttentionCard({ item, index }: { item: PulseAttentionItem; index: number }) {
  const isLow = item.confidence === 'low';
  return (
    <Animated.View entering={FadeInDown.duration(300).delay(100 + index * 60)}>
      <View style={[s.attCard, isLow ? s.attCardLow : s.attCardMed]}>
        <View style={s.attHeader}>
          <Text style={s.attEmoji}>{isLow ? '🔴' : '🟡'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.attTitle} numberOfLines={2}>{item.goal_title || 'Goal'}</Text>
            <Text style={s.attMeta}>
              {item.organization || item.council || 'Organization'}
              {item.user_name ? ` · ${item.user_name}` : ''}
            </Text>
          </View>
          {item.stuck_months >= 2 && (
            <View style={s.stuckBadge}>
              <Text style={s.stuckText}>Stuck {item.stuck_months}mo</Text>
            </View>
          )}
        </View>

        {item.health?.letters && <HealthLetterDots letters={item.health.letters} />}
        {item.confidence_history && item.confidence_history.length > 1 && (
          <ConfidenceHistoryDots history={item.confidence_history} />
        )}

        {item.support_types && item.support_types.length > 0 && (
          <View style={s.chipRow}>
            {item.support_types.map((chip) => (
              <View key={chip} style={s.supportChip}>
                <Text style={s.supportChipText}>{chip}</Text>
              </View>
            ))}
          </View>
        )}
        {item.support_note ? (
          <Text style={s.supportNote}>{`"${item.support_note}"`}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

function WardTable({ wards }: { wards: PulseWardRow[] }) {
  return (
    <View style={s.tableCard}>
      <View style={s.tableHeaderRow}>
        <Text style={[s.tableH, { flex: 2 }]}>Ward</Text>
        <Text style={[s.tableH, s.tableHCenter]}>🟢</Text>
        <Text style={[s.tableH, s.tableHCenter]}>🟡</Text>
        <Text style={[s.tableH, s.tableHCenter]}>🔴</Text>
      </View>
      {wards.map((w, i) => (
        <View key={i} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
          <Text style={[s.tableCell, { flex: 2, fontWeight: '600' as const }]} numberOfLines={1}>{w.ward_name}</Text>
          <Text style={[s.tableCell, s.tableCellCenter]}>{w.high}</Text>
          <Text style={[s.tableCell, s.tableCellCenter]}>{w.medium}</Text>
          <Text style={[s.tableCell, s.tableCellCenter]}>{w.low}</Text>
        </View>
      ))}
    </View>
  );
}

function SupportRequestsList({ requests }: { requests: PulseSupportRequest[] }) {
  const max = Math.max(...requests.map((r) => r.count), 1);
  return (
    <View>
      {requests.map((r) => (
        <View key={r.type} style={s.supportRow}>
          <Text style={s.supportType}>{r.type}</Text>
          <View style={s.supportBarTrack}>
            <View style={[s.supportBarFill, { width: `${Math.round((r.count / max) * 100)}%` }]} />
          </View>
          <Text style={s.supportCount}>{r.count}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main Screen ───────────────────────────

export default function AlignPulseScreen() {
  const insets = useSafeAreaInsets();
  const webBottomInset = WEB_BOTTOM_INSET;

  const { data, isLoading, isError, refetch, isRefetching } = useAlignPulseReport();

  if (isLoading) {
    return (
      <View style={[s.container, s.centered]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={s.loadingText}>Loading pulse report...</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[s.container, s.centered]}>
        <View style={s.errorBox}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.brand.error} />
          <Text style={s.errorTitle}>Unable to load pulse report</Text>
          <Text style={s.errorDesc}>Check your connection and try again.</Text>
          <AppButton label="Retry" onPress={() => refetch()} size="large" style={s.retryBtn} />
        </View>
      </View>
    );
  }

  const d = data;
  const cd = d.confidence_distribution;
  const total = cd.high + cd.medium + cd.low;
  const trend = d.trend;
  const hasTrend = trend?.has_previous_data;

  return (
    <View style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              triggerGlobalRefreshIndicator();
              refetch();
            }}
            tintColor={Colors.brand.primary}
          />
        }
      >
        <View style={s.contentWrap}>
          {/* ═══ Header ═══ */}
          <Animated.View entering={FadeIn.duration(300)} style={s.headerCard}>
            <View style={s.header}>
              <View style={s.headerIcon}>
                <MaterialCommunityIcons name="pulse" size={22} color={Colors.brand.primary} />
              </View>
              <View style={s.headerCopy}>
                <Text style={s.headerTitle}>ALIGN Pulse</Text>
                <Text style={s.headerSub}>{d.month_label} - Confidence votes from organization leaders.</Text>
              </View>
            </View>
          </Animated.View>

          {/* ═══ Summary Stats ═══ */}
          {total === 0 ? (
            <Animated.View entering={FadeIn.duration(400)} style={s.emptyState}>
              <View style={s.emptyIcon}>
                <MaterialCommunityIcons name="pulse" size={36} color={Colors.brand.primary} />
              </View>
              <Text style={s.emptyTitle}>No pulses yet</Text>
              <Text style={s.emptyDesc}>No organizations have submitted confidence votes for {d.month_label}.</Text>
            </Animated.View>
          ) : (
            <>
              <View style={s.statsRow}>
                <StatCard value={`${d.submission_rate}%`} label="Submitted" color={Colors.brand.primary} index={0} />
                <StatCard value={cd.high} label="🟢 Good" color={CONF_COLORS.high} delta={hasTrend ? trend.high_delta : undefined} index={1} />
                <StatCard value={cd.medium} label="🟡 Needs Work" color={CONF_COLORS.medium} delta={hasTrend ? trend.medium_delta : undefined} invertDelta index={2} />
                <StatCard value={cd.low} label="🔴 Stuck" color={CONF_COLORS.low} delta={hasTrend ? trend.low_delta : undefined} invertDelta index={3} />
              </View>

              {/* ═══ Trend Strip ═══ */}
              {hasTrend && (
                <Animated.View entering={FadeInDown.duration(300).delay(250)}>
                  <View style={s.trendStrip}>
                    <Ionicons name="trending-up-outline" size={14} color={Colors.brand.midGray} />
                    <Text style={s.trendLabel}>vs {trend.prev_month_label}</Text>
                  </View>
                </Animated.View>
              )}

              {/* ═══ Confidence Distribution ═══ */}
              <Animated.View entering={FadeInDown.duration(300).delay(300)}>
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Confidence Distribution</Text>
                  <ConfidenceBar high={cd.high} medium={cd.medium} low={cd.low} total={total} />
                  <View style={s.confLegend}>
                    <Text style={s.confLegendItem}>🟢 {Math.round((cd.high / total) * 100)}%</Text>
                    <Text style={s.confLegendItem}>🟡 {Math.round((cd.medium / total) * 100)}%</Text>
                    <Text style={s.confLegendItem}>🔴 {Math.round((cd.low / total) * 100)}%</Text>
                  </View>
                </View>
              </Animated.View>

              {/* ═══ Needs Attention ═══ */}
              {d.needs_attention.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>
                    <Ionicons name="alert-circle-outline" size={16} color={CONF_COLORS.low} />
                    {'  '}Needs Attention
                  </Text>
                  <Text style={s.sectionDesc}>Goals where leaders signalled they need help.</Text>
                  {d.needs_attention.slice(0, 8).map((item, i) => (
                    <AttentionCard key={`${item.goal_id}-${i}`} item={item} index={i} />
                  ))}
                </View>
              )}

              {/* ═══ By Ward ═══ */}
              {d.by_ward.length > 0 && (
                <Animated.View entering={FadeInDown.duration(300).delay(400)}>
                  <View style={s.section}>
                    <Text style={s.sectionTitle}>By Ward</Text>
                    <WardTable wards={d.by_ward} />
                  </View>
                </Animated.View>
              )}

              {/* ═══ Support Requests ═══ */}
              {d.support_requests.length > 0 && (
                <Animated.View entering={FadeInDown.duration(300).delay(450)}>
                  <View style={s.section}>
                    <Text style={s.sectionTitle}>
                      <Ionicons name="hand-left-outline" size={16} color={Colors.brand.warning} />
                      {'  '}Support Requests
                    </Text>
                    <SupportRequestsList requests={d.support_requests} />
                  </View>
                </Animated.View>
              )}

              {/* ═══ Missing Orgs ═══ */}
              {d.missing_orgs.length > 0 && (
                <Animated.View entering={FadeInDown.duration(300).delay(500)}>
                  <View style={s.section}>
                    <Text style={s.sectionTitle}>Missing Submissions</Text>
                    <Text style={s.sectionDesc}>
                      {d.meta.missing_org_count} organization{d.meta.missing_org_count !== 1 ? 's haven\'t' : ' hasn\'t'} submitted yet.
                    </Text>
                    {d.missing_orgs.map((org) => (
                      <View key={org.id} style={s.missingRow}>
                        <Text style={s.missingName}>{org.name}</Text>
                        {org.ward && <Text style={s.missingWard}>{org.ward}</Text>}
                      </View>
                    ))}
                  </View>
                </Animated.View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },
  errorBox: { alignItems: 'center', paddingHorizontal: 32 },
  errorTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.brand.black, marginTop: 16, fontFamily: 'Inter_600SemiBold' },
  errorDesc: { fontSize: 14, color: Colors.brand.darkGray, marginTop: 6, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  retryBtn: { marginTop: 20, minWidth: 152 },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 4 },
  contentWrap: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 20 },

  headerCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 4, 14),
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.brand.black, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 15, color: Colors.brand.darkGray, marginTop: 4, fontFamily: 'Inter_400Regular', lineHeight: 21 },

  // Stats
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: Colors.brand.white,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 2, 8),
    elevation: 2,
  },
  statValue: { fontSize: 26, fontWeight: '700' as const, lineHeight: 32, fontFamily: 'Inter_700Bold' },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statLabel: { fontSize: 14, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },
  deltaBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  deltaText: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },

  // Trend strip
  trendStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.brand.sectionBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 16,
  },
  trendLabel: { fontSize: 14, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },

  // Confidence bar
  confBarOuter: {
    height: 28,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: Colors.brand.lightGray,
  },
  confBarSeg: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  confBarNum: { fontSize: 15, fontWeight: '700' as const, color: '#fff', fontFamily: 'Inter_700Bold' },
  confLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  confLegendItem: { fontSize: 14, color: Colors.brand.darkGray, fontFamily: 'Inter_400Regular' },

  // Sections
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.brand.black, marginBottom: 6, fontFamily: 'Inter_700Bold' },
  sectionDesc: { fontSize: 15, color: Colors.brand.darkGray, marginBottom: 10, fontFamily: 'Inter_400Regular' },

  // Attention cards
  attCard: { borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3 },
  attCardLow: { backgroundColor: '#fef2f2', borderLeftColor: CONF_COLORS.low },
  attCardMed: { backgroundColor: '#fffbeb', borderLeftColor: CONF_COLORS.medium },
  attHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  attEmoji: { fontSize: 16, marginTop: 1 },
  attTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.black, fontFamily: 'Inter_600SemiBold' },
  attMeta: { fontSize: 14, color: Colors.brand.darkGray, marginTop: 2, fontFamily: 'Inter_400Regular' },
  stuckBadge: { backgroundColor: '#fecaca', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  stuckText: { fontSize: 14, fontWeight: '700' as const, color: '#991b1b', fontFamily: 'Inter_700Bold' },

  // Health letter dots
  healthRow: { flexDirection: 'row', gap: 4, marginTop: 8, alignItems: 'center' },
  healthDot: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  healthDotText: { fontSize: 9, fontWeight: '700' as const, color: '#fff', fontFamily: 'Inter_700Bold' },

  // Confidence history
  historyRow: { flexDirection: 'row', gap: 4, marginTop: 6 },
  historyDot: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  historyDotText: { fontSize: 14, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },

  // Support chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  supportChip: { backgroundColor: '#fef9c3', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  supportChipText: { fontSize: 15, fontWeight: '500' as const, color: '#92400e', fontFamily: 'Inter_500Medium' },
  supportNote: { fontSize: 14, fontStyle: 'italic', color: '#92400e', marginTop: 6, fontFamily: 'Inter_400Regular' },

  // Ward table
  tableCard: {
    backgroundColor: Colors.brand.white,
    borderRadius: 12,
    overflow: 'hidden',
    ...webShadowRgba('rgba(15, 23, 42, 0.06)', 0, 1, 4),
    elevation: 1,
  },
  tableHeaderRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.brand.sectionBg },
  tableH: { fontSize: 15, fontWeight: '600' as const, color: Colors.brand.midGray, fontFamily: 'Inter_600SemiBold' },
  tableHCenter: { textAlign: 'center', width: 40 },
  tableRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.brand.lightGray },
  tableRowAlt: { backgroundColor: Colors.brand.offWhite },
  tableCell: { fontSize: 15, color: Colors.brand.black, fontFamily: 'Inter_400Regular' },
  tableCellCenter: { textAlign: 'center', width: 40 },

  // Support requests bars
  supportRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  supportType: { width: 70, fontSize: 15, fontWeight: '500' as const, color: Colors.brand.darkGray, fontFamily: 'Inter_500Medium' },
  supportBarTrack: { flex: 1, height: 8, backgroundColor: Colors.brand.lightGray, borderRadius: 4, overflow: 'hidden' },
  supportBarFill: { height: '100%', backgroundColor: '#fbbf24', borderRadius: 4 },
  supportCount: { width: 24, textAlign: 'right', fontSize: 15, fontWeight: '700' as const, color: Colors.brand.black, fontFamily: 'Inter_700Bold' },

  // Missing orgs
  missingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.brand.lightGray },
  missingName: { fontSize: 15, color: Colors.brand.black, fontFamily: 'Inter_500Medium' },
  missingWard: { fontSize: 14, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.brand.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.brand.black, marginBottom: 6, fontFamily: 'Inter_600SemiBold' },
  emptyDesc: { fontSize: 14, color: Colors.brand.darkGray, textAlign: 'center', fontFamily: 'Inter_400Regular' },
});
