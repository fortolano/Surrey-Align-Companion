import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
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
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import AppButton from '@/components/ui/AppButton';
import AppInput from '@/components/ui/AppInput';
import {
  useCouncilAgendas,
  useSubmitAgendaItem,
  type AgendaSummary,
  type AgendaSection,
  type AgendaItemData,
} from '@/lib/agenda-api';

// ─── Item type → Ionicons mapping ───────────────

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

function getItemIcon(type: string) {
  return ITEM_ICONS[type] || { name: 'ellipsis-horizontal-outline', color: Colors.brand.midGray };
}

// ─── Priority chip colors ───────────────────────

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: Colors.brand.sectionBg, text: Colors.brand.midGray },
  normal: { bg: Colors.brand.primary + '18', text: Colors.brand.primary },
  high: { bg: '#FEF2F2', text: '#DC2626' },
};

// ─── Sub-components ─────────────────────────────

// Item types where the title is typically just the person's name
const PERSON_CENTRIC_TYPES = new Set(['prayer', 'spiritual_thought', 'speaker']);

function AgendaItemRow({ item }: { item: AgendaItemData }) {
  const icon = getItemIcon(item.item_type);

  // For prayer/spiritual thought/speaker: the "title" is often the person's name,
  // duplicating presenter_name. Show the type label as title, name once as subtitle.
  const titleMatchesPresenter = item.title && item.presenter_name &&
    item.title.trim().toLowerCase() === item.presenter_name.trim().toLowerCase();
  const isPersonCentric = PERSON_CENTRIC_TYPES.has(item.item_type);

  let displayTitle: string;
  let displaySubtitle: string | null;

  if (titleMatchesPresenter || (isPersonCentric && !item.title)) {
    // Show type label as title, person's name as subtitle (once)
    displayTitle = item.item_type_label;
    displaySubtitle = item.presenter_name || item.title || null;
  } else {
    displayTitle = item.title || item.item_type_label;
    displaySubtitle = item.presenter_name ?? null;
  }

  const hasDuration = !!item.duration_minutes;
  const hasHymn = item.item_type === 'hymn' && !!item.hymn_number;
  const showChipRow = item.is_mine || hasHymn;

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
          {hasDuration && (
            <Text style={itemS.duration}>{item.duration_minutes} min</Text>
          )}
        </View>
        {displaySubtitle ? (
          <Text style={itemS.presenter} numberOfLines={1}>
            {displaySubtitle}
          </Text>
        ) : null}
        {showChipRow && (
          <View style={itemS.chipRow}>
            {item.is_mine && (
              <View style={itemS.mineBadge}>
                <Text style={itemS.mineBadgeText}>Your assignment</Text>
              </View>
            )}
            {hasHymn && (
              <Text style={itemS.duration}>#{item.hymn_number}</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function SectionBlock({ section, expanded, onToggle }: {
  section: AgendaSection;
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
      {expanded && (
        <View style={secS.items}>
          {section.items.map((item) => (
            <AgendaItemRow key={item.id} item={item} />
          ))}
        </View>
      )}
    </View>
  );
}

function AgendaCard({ agenda, index, defaultExpanded }: {
  agenda: AgendaSummary;
  index: number;
  defaultExpanded: boolean;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    if (!defaultExpanded) return {};
    const map: Record<string, boolean> = {};
    agenda.sections.forEach((s) => { map[s.key] = true; });
    return map;
  });
  const [cardExpanded, setCardExpanded] = useState(defaultExpanded);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCard = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !cardExpanded;
    setCardExpanded(next);
    if (next) {
      const map: Record<string, boolean> = {};
      agenda.sections.forEach((s) => { map[s.key] = true; });
      setExpandedSections(map);
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(350).delay(80 + index * 60)}>
      <View style={cardStyles.card}>
        <Pressable onPress={toggleCard} style={cardStyles.cardHeader} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={cardStyles.cardTitle}>{agenda.title}</Text>
            <View style={cardStyles.metaRow}>
              {agenda.meeting_date_label && (
                <View style={cardStyles.metaItem}>
                  <Ionicons name="calendar-outline" size={13} color={Colors.brand.midGray} />
                  <Text style={cardStyles.metaText}>{agenda.meeting_date_label}</Text>
                </View>
              )}
              {agenda.meeting_time && (
                <View style={cardStyles.metaItem}>
                  <Ionicons name="time-outline" size={13} color={Colors.brand.midGray} />
                  <Text style={cardStyles.metaText}>{agenda.meeting_time}</Text>
                </View>
              )}
            </View>
            {agenda.location ? (
              <View style={cardStyles.metaItem}>
                <Ionicons name="location-outline" size={13} color={Colors.brand.midGray} />
                <Text style={cardStyles.metaText}>{agenda.location}</Text>
              </View>
            ) : null}
          </View>
          <View style={cardStyles.headerRight}>
            {agenda.my_item_count > 0 && (
              <View style={cardStyles.myBadge}>
                <Text style={cardStyles.myBadgeText}>{agenda.my_item_count} yours</Text>
              </View>
            )}
            <Ionicons
              name={cardExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={Colors.brand.midGray}
            />
          </View>
        </Pressable>

        {cardExpanded && agenda.sections.length > 0 && (
          <View style={cardStyles.sectionsWrap}>
            {agenda.sections.map((section) => (
              <SectionBlock
                key={section.key}
                section={section}
                expanded={!!expandedSections[section.key]}
                onToggle={() => toggleSection(section.key)}
              />
            ))}
          </View>
        )}

        {cardExpanded && agenda.sections.every((s) => s.items.length === 0) && (
          <View style={cardStyles.noItems}>
            <Text style={cardStyles.noItemsText}>No items in this agenda yet.</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function SubmitModal({ visible, onClose, councilSlug, councilName }: {
  visible: boolean;
  onClose: () => void;
  councilSlug: string;
  councilName: string;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');

  const mutation = useSubmitAgendaItem();

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    mutation.mutate(
      {
        council_slug: councilSlug,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
      },
      {
        onSuccess: () => {
          setTitle('');
          setDescription('');
          setPriority('normal');
          onClose();
        },
      }
    );
  };

  const handleClose = () => {
    if (mutation.isPending) return;
    setTitle('');
    setDescription('');
    setPriority('normal');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={modalS.overlay}
      >
        <Pressable style={modalS.backdrop} onPress={handleClose} />
        <View style={modalS.sheet}>
          <View style={modalS.handle} />
          <Text style={modalS.sheetTitle}>Submit Agenda Item</Text>
          <Text style={modalS.sheetSub}>Submit to {councilName} for review.</Text>

          <Text style={modalS.label}>Title *</Text>
          <AppInput
            value={title}
            onChangeText={setTitle}
            placeholder="What would you like discussed?"
            maxLength={255}
            style={{ marginBottom: 12 }}
          />

          <Text style={modalS.label}>Description</Text>
          <AppInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add details or context (optional)"
            maxLength={2000}
            multiline
            numberOfLines={3}
            style={{ marginBottom: 12, minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }}
          />

          <Text style={modalS.label}>Priority</Text>
          <View style={modalS.chipRow}>
            {(['low', 'normal', 'high'] as const).map((p) => {
              const isActive = priority === p;
              const colors = PRIORITY_COLORS[p];
              return (
                <Pressable
                  key={p}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    setPriority(p);
                  }}
                  style={[
                    modalS.chip,
                    {
                      backgroundColor: isActive ? colors.bg : Colors.brand.sectionBg,
                      borderColor: isActive ? colors.text : 'transparent',
                    },
                  ]}
                >
                  <Text style={[modalS.chipText, { color: isActive ? colors.text : Colors.brand.midGray }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mutation.isError && (
            <Text style={modalS.errorText}>{mutation.error?.message || 'Submission failed.'}</Text>
          )}

          <View style={modalS.actions}>
            <Pressable onPress={handleClose} style={modalS.cancelBtn}>
              <Text style={modalS.cancelText}>Cancel</Text>
            </Pressable>
            <AppButton
              label="Submit"
              onPress={handleSubmit}
              loading={mutation.isPending}
              disabled={!title.trim()}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen (shared between HC and SC) ─────

export function CouncilAgendaScreen({ councilSlug }: { councilSlug: string }) {
  const insets = useSafeAreaInsets();
  const [showSubmit, setShowSubmit] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useCouncilAgendas(councilSlug);

  // Re-fetch when screen gains focus (user navigates here or switches back to app)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (isLoading) {
    return (
      <View style={[s.container, s.centered]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={s.loadingText}>Loading agendas...</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[s.container, s.centered]}>
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.brand.error} />
        <Text style={s.errorTitle}>Unable to load agendas</Text>
        <Text style={s.errorDesc}>Check your connection and try again.</Text>
        <Pressable onPress={() => refetch()} style={s.retryBtn}>
          <Text style={s.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const agendas = data.agendas || [];
  const council = data.council;
  const canSubmit = data.can_submit;

  return (
    <View style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + WEB_BOTTOM_INSET + 24 }]}
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
          <Animated.View entering={FadeIn.duration(300)}>
            <View style={s.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.headerSub}>Published agendas for {council.name}.</Text>
              </View>
              {canSubmit && (
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowSubmit(true);
                  }}
                  style={s.addBtn}
                  accessibilityLabel="Submit agenda item"
                >
                  <Ionicons name="add" size={20} color={Colors.brand.white} />
                </Pressable>
              )}
            </View>
          </Animated.View>

          {agendas.length === 0 ? (
            <View style={s.emptyState}>
              <View style={s.emptyIcon}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={Colors.brand.primary} />
              </View>
              <Text style={s.emptyTitle}>No published agendas</Text>
              <Text style={s.emptyDesc}>
                No agendas have been published for {council.name} yet.
              </Text>
            </View>
          ) : (
            agendas.map((agenda, index) => (
              <AgendaCard
                key={agenda.id}
                agenda={agenda}
                index={index}
                defaultExpanded={index === 0 && agenda.is_upcoming}
              />
            ))
          )}
        </View>
      </ScrollView>

      {canSubmit && (
        <SubmitModal
          visible={showSubmit}
          onClose={() => setShowSubmit(false)}
          councilSlug={councilSlug}
          councilName={council.name}
        />
      )}
    </View>
  );
}

// ─── Default export (HC wrapper) ────────────────

export default function HighCouncilAgendaScreen() {
  return <CouncilAgendaScreen councilSlug="high-council" />;
}

// ─── Styles ─────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 15, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },
  errorTitle: { fontSize: 20, fontWeight: '600' as const, color: Colors.brand.black, marginTop: 16, fontFamily: 'Inter_600SemiBold' },
  errorDesc: { fontSize: 15, color: Colors.brand.darkGray, marginTop: 6, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  retryBtn: { marginTop: 20, backgroundColor: Colors.brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 15, fontWeight: '600' as const, color: Colors.brand.white, fontFamily: 'Inter_600SemiBold' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 4 },
  contentWrap: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 20 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 14 },
  headerSub: { fontSize: 15, color: Colors.brand.darkGray, fontFamily: 'Inter_400Regular' },

  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...webShadowRgba('rgba(1, 97, 131, 0.3)', 0, 3, 8),
    elevation: 4,
  },

  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.brand.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600' as const, color: Colors.brand.black, marginBottom: 6, fontFamily: 'Inter_600SemiBold' },
  emptyDesc: { fontSize: 15, color: Colors.brand.darkGray, textAlign: 'center', fontFamily: 'Inter_400Regular' },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 3, 10),
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '700' as const,
    color: Colors.brand.black,
    marginBottom: 6,
    fontFamily: 'Inter_700Bold',
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 15, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },
  headerRight: { alignItems: 'flex-end', gap: 6 },
  myBadge: { backgroundColor: Colors.brand.primary + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  myBadgeText: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.primary, fontFamily: 'Inter_600SemiBold' },
  sectionsWrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.brand.lightGray, paddingBottom: 4 },
  noItems: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.brand.lightGray },
  noItemsText: { fontSize: 15, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});

const secS = StyleSheet.create({
  block: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.brand.lightGray },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '600' as const, color: Colors.brand.darkGray, textTransform: 'uppercase' as const, letterSpacing: 0.4, fontFamily: 'Inter_600SemiBold' },
  countBadge: { backgroundColor: Colors.brand.sectionBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  countText: { fontSize: 13, fontWeight: '600' as const, color: Colors.brand.midGray, fontFamily: 'Inter_600SemiBold' },
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
  title: { flex: 1, fontSize: 16, fontWeight: '500' as const, color: Colors.brand.dark, fontFamily: 'Inter_500Medium', lineHeight: 22 },
  presenter: { fontSize: 15, color: Colors.brand.darkGray, fontFamily: 'Inter_400Regular', marginTop: 2 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  mineBadge: { backgroundColor: '#1E40AF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  mineBadgeText: { fontSize: 13, fontWeight: '700' as const, color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  duration: { fontSize: 14, color: Colors.brand.midGray, fontFamily: 'Inter_400Regular' },
});

const modalS = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.brand.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    maxHeight: '85%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.brand.lightGray, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.brand.black, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  sheetSub: { fontSize: 15, color: Colors.brand.darkGray, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600' as const, color: Colors.brand.darkGray, fontFamily: 'Inter_600SemiBold', marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  errorText: { fontSize: 14, color: Colors.brand.error, fontFamily: 'Inter_400Regular', marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { justifyContent: 'center', paddingHorizontal: 16 },
  cancelText: { fontSize: 15, fontWeight: '600' as const, color: Colors.brand.midGray, fontFamily: 'Inter_600SemiBold' },
});
