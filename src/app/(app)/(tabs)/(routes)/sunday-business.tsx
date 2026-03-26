import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { webShadowRgba } from '@/lib/web-styles';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Modal,
  RefreshControl,
  Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import { setActiveLeaveGuard } from '@/lib/navigation-leave-guard';
import { appAlert } from '@/lib/platform-alert';
import { triggerGlobalRefreshIndicator } from '@/lib/refresh-indicator';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';
import AppButton from '@/components/ui/AppButton';
import AppInteractiveChip from '@/components/ui/AppInteractiveChip';
import AppPickerTrigger from '@/components/ui/AppPickerTrigger';

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

type ScriptLanguageCode = 'EN' | 'ES' | 'PT' | 'CH' | 'HI' | 'TL';
type ScriptLanguageOption = { key: ScriptLanguageCode; label: string };
type RelevantWard = Ward & { allDone: boolean; doneCount: number; totalCount: number };
type PendingExitIntent = { continueNavigation: () => void };

const SCRIPT_LANGUAGE_OPTIONS: ScriptLanguageOption[] = [
  { key: 'EN', label: 'English' },
  { key: 'ES', label: 'Español' },
  { key: 'PT', label: 'Português' },
  { key: 'CH', label: '中文' },
  { key: 'HI', label: 'Hindi' },
  { key: 'TL', label: 'Tagalog' },
];
const EMPTY_WARDS: Ward[] = [];
const EMPTY_SUNDAY_ITEMS: SundayBusinessItem[] = [];

function getScriptLanguageLabel(language: ScriptLanguageCode): string {
  return SCRIPT_LANGUAGE_OPTIONS.find((option) => option.key === language)?.label ?? language;
}

function getTranslatedScript(item: SundayBusinessItem, language: ScriptLanguageCode): string {
  const name = item.person_name;
  const calling = item.calling_name;

  if (language === 'EN') return item.script_text;

  if (language === 'ES') {
    if (item.item_type === 'release') {
      return `${name} ha sido relevado(a) como ${calling}. Quienes deseen expresar gratitud por su servicio, sírvanse manifestarlo levantando la mano.`;
    }
    return `${name} ha sido llamado(a) como ${calling}. Los que estén a favor de sostenerle, sírvanse manifestarlo levantando la mano. [Pausa breve.] Los que estén en contra, si los hay, también pueden manifestarlo. [Pausa breve.]`;
  }

  if (language === 'PT') {
    if (item.item_type === 'release') {
      return `${name} foi desobrigado(a) como ${calling}. Os que desejarem expressar gratidão por seu serviço podem manifestá-lo com a mão levantada.`;
    }
    return `${name} foi chamado(a) como ${calling}. Os que estiverem a favor de apoiá-lo(a), manifestem-no com a mão levantada. [Pausa breve.] Os que forem contra, se houver, também podem manifestá-lo. [Pausa breve.]`;
  }

  if (language === 'CH') {
    if (item.item_type === 'release') {
      return `${name} 已被解除 ${calling} 的职务。愿意对他/她的服务表示感谢的，请举手表示。`;
    }
    return `${name} 已蒙召担任 ${calling}。赞成支持他/她的，请举手表示。[稍作停顿。] 如有反对，也请举手表示。[稍作停顿。]`;
  }

  if (language === 'HI') {
    if (item.item_type === 'release') {
      return `${name} को ${calling} के रूप में सेवा से मुक्त किया गया है। जो लोग उनकी सेवा के लिए धन्यवाद व्यक्त करना चाहते हैं, वे हाथ उठाकर संकेत दें।`;
    }
    return `${name} को ${calling} के रूप में बुलाया गया है। जो लोग उनके समर्थन में हैं, कृपया हाथ उठाकर संकेत दें। [संक्षिप्त विराम।] यदि कोई विरोध में हो, तो वह भी हाथ उठाकर संकेत दे। [संक्षिप्त विराम।]`;
  }

  // TL (Tagalog)
  if (item.item_type === 'release') {
    return `Si ${name} ay pinalaya na bilang ${calling}. Ang mga nagnanais magpahayag ng pasasalamat sa kanyang paglilingkod ay maipapakita ito sa pagtataas ng kamay.`;
  }
  return `Si ${name} ay tinawag bilang ${calling}. Ang mga sumasang-ayon na sang-ayunan siya ay maaaring magpakita nito sa pagtataas ng kamay. [Sandaling paghinto.] Ang mga tumututol, kung mayroon man, ay maaari ring magpakita nito. [Sandaling paghinto.]`;
}

function TypeGroupCard({ itemType, items, selectedWardId, scriptLanguage, onChangeScriptLanguage }: {
  itemType: 'release' | 'sustaining';
  items: SundayBusinessItem[];
  selectedWardId: number | null;
  scriptLanguage: ScriptLanguageCode;
  onChangeScriptLanguage: (language: ScriptLanguageCode) => void;
}) {
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
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
  const scriptSurface = itemType === 'release' ? '#FFF8DB' : '#EEF5FF';
  const scriptBorder = itemType === 'release' ? '#FDE68A' : '#BFDBFE';
  const scriptBlockSurface = itemType === 'release' ? '#FFFBEB' : '#F7FAFF';
  const scriptLanguageLabel = getScriptLanguageLabel(scriptLanguage);

  const handleShareScripts = async () => {
    if (pendingItems.length === 0) return;

    const scriptBlocks = pendingItems.map((item, idx) => {
      const itemLabel = pendingItems.length > 1
        ? `${idx + 1}. ${item.person_name} - ${item.calling_name}\n`
        : '';
      return `${itemLabel}${getTranslatedScript(item, scriptLanguage)}`;
    });

    const shareTitle = `${title} Scripts`;
    const shareMessage = `${shareTitle} (${scriptLanguageLabel})\n\n${scriptBlocks.join('\n\n')}`;

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
        await (navigator as any).share({ title: shareTitle, text: shareMessage });
      } else {
        await Share.share({ title: shareTitle, message: shareMessage });
      }
      if (Platform.OS !== 'web') Haptics.selectionAsync();
    } catch (err: any) {
      const isCanceled = typeof err?.message === 'string' && err.message.toLowerCase().includes('canceled');
      if (!isCanceled) {
        appAlert('Unable to share', 'Could not open sharing options right now.');
      }
    }
  };

  if (count === 0) return null;

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <View style={[cardStyles.typeIndicator, { backgroundColor: accentColor }]} />
        <View style={[cardStyles.headerChip, { backgroundColor: headerBg }]}>
          <Text style={[cardStyles.headerChipText, { color: headerColor }]}>{title.toUpperCase()}</Text>
        </View>
        <Text style={cardStyles.countLabel}>{count} {count === 1 ? 'item' : 'items'}</Text>
        <Pressable onPress={handleShareScripts} style={cardStyles.headerShareBtn} hitSlop={6}>
          <Ionicons name="share-social-outline" size={16} color={Colors.brand.primary} />
        </Pressable>
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

      <View style={[cardStyles.scriptSection, { backgroundColor: scriptSurface, borderColor: scriptBorder }]}>
        <View style={cardStyles.scriptHeader}>
          <View style={cardStyles.scriptHeaderTitle}>
            <Ionicons name="document-text-outline" size={14} color={headerColor} />
            <Text style={[cardStyles.scriptHeaderText, { color: headerColor }]}>
              {count === 1 ? 'Script' : 'Scripts'}
            </Text>
          </View>
        </View>
        <View style={cardStyles.scriptLanguageControl}>
          <Text style={cardStyles.scriptLanguageLabel}>Language</Text>
          <AppPickerTrigger
            label={scriptLanguageLabel}
            onPress={() => setShowLanguageMenu((current) => !current)}
            style={cardStyles.scriptLanguageTrigger}
          />
          {showLanguageMenu ? (
            <View style={cardStyles.scriptLanguageMenu}>
              {SCRIPT_LANGUAGE_OPTIONS.map((option, idx) => {
                const active = option.key === scriptLanguage;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      onChangeScriptLanguage(option.key);
                      setShowLanguageMenu(false);
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                    }}
                    style={[
                      cardStyles.scriptLanguageOption,
                      active && cardStyles.scriptLanguageOptionActive,
                      idx < SCRIPT_LANGUAGE_OPTIONS.length - 1 && cardStyles.scriptLanguageOptionBorder,
                    ]}
                  >
                    <View style={cardStyles.scriptLanguageOptionBody}>
                      <Text style={[cardStyles.scriptLanguageOptionText, active && cardStyles.scriptLanguageOptionTextActive]}>
                        {option.label}
                      </Text>
                      <Text style={[cardStyles.scriptLanguageOptionCode, active && cardStyles.scriptLanguageOptionCodeActive]}>
                        {option.key}
                      </Text>
                    </View>
                    {active ? <Ionicons name="checkmark-circle" size={18} color={headerColor} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
        {pendingItems.map((item, idx) => (
          <View
            key={item.id}
            style={[
              cardStyles.scriptBlock,
              { backgroundColor: scriptBlockSurface, borderColor: scriptBorder },
              idx > 0 && { marginTop: 10 },
            ]}
          >
            {count > 1 && (
              <Text style={cardStyles.scriptPersonLabel}>{item.person_name}:</Text>
            )}
            <View style={cardStyles.scriptTextRow}>
              <View style={[cardStyles.scriptBar, { backgroundColor: accentColor }]} />
              <Text style={cardStyles.scriptText}>{getTranslatedScript(item, scriptLanguage)}</Text>
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
    fontSize: 14,
    fontWeight: '700' as const,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  headerShareBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    backgroundColor: Colors.brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countLabel: {
    fontSize: 15,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
    flex: 1,
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
    fontSize: 15,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  orgName: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  scriptSection: {
    marginTop: 14,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  scriptHeader: {
    marginBottom: 8,
  },
  scriptHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scriptHeaderText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  scriptLanguageControl: {
    marginBottom: 12,
    gap: 8,
  },
  scriptLanguageLabel: {
    fontSize: 14,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  scriptLanguageTrigger: {
    backgroundColor: Colors.brand.white,
  },
  scriptLanguageMenu: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brand.inputBorder,
    backgroundColor: Colors.brand.white,
    overflow: 'hidden',
    ...webShadowRgba('rgba(15, 23, 42, 0.08)', 0, 3, 8),
    elevation: 2,
  },
  scriptLanguageOption: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  scriptLanguageOptionActive: {
    backgroundColor: Colors.brand.offWhite,
  },
  scriptLanguageOptionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.brand.lightGray,
  },
  scriptLanguageOptionBody: {
    flex: 1,
  },
  scriptLanguageOptionText: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_500Medium',
  },
  scriptLanguageOptionTextActive: {
    fontFamily: 'Inter_600SemiBold',
  },
  scriptLanguageOptionCode: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  scriptLanguageOptionCodeActive: {
    color: Colors.brand.primary,
  },
  scriptBlock: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  scriptPersonLabel: {
    fontSize: 14,
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
    fontSize: 17,
    color: Colors.brand.dark,
    lineHeight: 28,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic' as const,
  },
});

function AnimatedHandPrompt() {
  const translateY = useSharedValue(0);

  React.useEffect(() => {
    translateY.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.handPrompt, animStyle]}>
      <MaterialCommunityIcons name="gesture-tap" size={44} color={Colors.brand.primary} />
    </Animated.View>
  );
}

export default function SundayBusinessScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const qClient = useQueryClient();
  const navigation = useNavigation();
  const webBottomInset = WEB_BOTTOM_INSET;

  const [selectedWardId, setSelectedWardId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [scriptLanguage, setScriptLanguage] = useState<ScriptLanguageCode>('EN');
  const [showReminderSheet, setShowReminderSheet] = useState(false);
  const pendingExitIntentRef = useRef<PendingExitIntent | null>(null);
  const allowStackExitRef = useRef(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<SundayBusinessResponse>({
    queryKey: ['/api/sunday-business/sunday'],
    queryFn: () => authFetch(token, '/api/sunday-business/sunday'),
    enabled: !!token,
    staleTime: 30000,
  });

  const handleRefresh = useCallback(() => {
    triggerGlobalRefreshIndicator();
    refetch();
  }, [refetch]);

  const wards = data?.wards ?? EMPTY_WARDS;
  const allItems = data?.business_items ?? EMPTY_SUNDAY_ITEMS;
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

  const continuePendingExit = useCallback(() => {
    const pendingExitIntent = pendingExitIntentRef.current;
    pendingExitIntentRef.current = null;
    setShowReminderSheet(false);

    if (!pendingExitIntent) return;
    pendingExitIntent.continueNavigation();
  }, []);

  const stayOnPage = useCallback(() => {
    pendingExitIntentRef.current = null;
    setShowReminderSheet(false);
  }, []);

  const markAllConducted = useCallback(async (options?: { continuePendingExit?: boolean }) => {
    if (!selectedWardId || outstandingWardItems.length === 0) return;
    setMarkingAll(true);
    const shouldContinuePendingExit = options?.continuePendingExit === true;
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
      if (shouldContinuePendingExit) {
        continuePendingExit();
      } else {
        setShowReminderSheet(false);
      }
      if (anyStepUpdated && !shouldContinuePendingExit) {
        appAlert('Updated', 'Calling lifecycle steps have been updated.');
      }
    } catch (err: any) {
      appAlert('Error', err.message || 'Failed to mark as conducted.');
    } finally {
      setMarkingAll(false);
    }
  }, [selectedWardId, outstandingWardItems, token, qClient, continuePendingExit]);

  const relevantWards = useMemo((): RelevantWard[] => {
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

  const outstandingSelectableWards = useMemo(
    () => relevantWards.filter((ward) => !ward.allDone),
    [relevantWards]
  );

  const completedWards = useMemo(
    () => relevantWards.filter((ward) => ward.allDone),
    [relevantWards]
  );

  const handleSelectWard = useCallback((wardId: number) => {
    setSelectedWardId((current) => (current === wardId ? null : wardId));
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  }, []);

  const showWardSelector = userContext?.role !== 'ward_leader';
  const wardPromptText = userContext?.role === 'high_councilor'
    ? 'Which ward are you attending this Sunday?'
    : 'Select a ward to view business';
  const remainingCount = outstandingWardItems.length;
  const reminderWardName = selectedWard?.name ?? 'this ward';
  const reminderActionLabel = remainingCount === 1
    ? `Mark ${outstandingWardItems[0]?.item_type === 'release' ? 'Release' : 'Sustaining'} as Conducted`
    : `Mark All ${remainingCount} Items as Conducted`;
  const reminderMessage = `You are leaving Stake Business for ${reminderWardName}. If the business has already been conducted, tap "${reminderActionLabel}" before you go.`;

  useEffect(() => {
    const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', (event: any) => {
      if (allowStackExitRef.current) return;
      if (!selectedWardId || remainingCount === 0 || markingAll) return;

      event.preventDefault();
      pendingExitIntentRef.current = {
        continueNavigation: () => {
          allowStackExitRef.current = true;
          navigation.dispatch(event.data.action);
          setTimeout(() => {
            allowStackExitRef.current = false;
          }, 0);
        },
      };
      setShowReminderSheet(true);
    });

    return () => {
      unsubscribeBeforeRemove();
    };
  }, [navigation, selectedWardId, remainingCount, markingAll]);

  useEffect(() => {
    if (!selectedWardId || remainingCount === 0 || markingAll) {
      setActiveLeaveGuard(null);
      return;
    }

    setActiveLeaveGuard((request) => {
      pendingExitIntentRef.current = { continueNavigation: request.continueNavigation };
      setShowReminderSheet(true);
      return true;
    });

    return () => {
      setActiveLeaveGuard(null);
    };
  }, [selectedWardId, remainingCount, markingAll]);

  useEffect(() => {
    if (!selectedWardId || remainingCount === 0) {
      pendingExitIntentRef.current = null;
      setShowReminderSheet(false);
    }
  }, [selectedWardId, remainingCount]);

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
        <AppButton label="Retry" onPress={() => refetch()} size="large" style={styles.retryBtn} />
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
    <>
      <Modal
        visible={showReminderSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReminderSheet(false)}
      >
        <View style={styles.reminderOverlay}>
          <View style={styles.reminderSheet} testID="sunday-leave-reminder">
            <View style={styles.reminderIconWrap}>
              <Ionicons name="notifications-outline" size={18} color="#92400E" />
            </View>
            <Text style={styles.reminderTitle}>Sunday Business Reminder</Text>
            <Text style={styles.reminderBody}>{reminderMessage}</Text>
            <View style={styles.reminderActions}>
              <AppButton
                label="Stay on Page"
                onPress={stayOnPage}
                variant="secondary"
                size="large"
                disabled={markingAll}
                style={styles.reminderSecondaryBtn}
                testID="sunday-leave-stay"
              />
              <AppButton
                label="Leave Anyway"
                onPress={continuePendingExit}
                variant="danger"
                size="large"
                disabled={markingAll}
                style={styles.reminderLeaveBtn}
                testID="sunday-leave-anyway"
              />
              <AppButton
                label={remainingCount === 1 ? 'Mark It Now' : 'Mark All Now'}
                onPress={() => {
                  void markAllConducted({ continuePendingExit: true });
                }}
                loading={markingAll}
                size="large"
                style={styles.reminderPrimaryBtn}
                testID="sunday-leave-mark-now"
              />
            </View>
          </View>
        </View>
      </Modal>

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
          <Animated.View entering={FadeIn.duration(300)} style={styles.wardSelectorCard}>
            <Text style={styles.wardPrompt}>{wardPromptText}</Text>
            <Text style={styles.wardHelperText}>
              {selectedWard
                ? `Selected ward: ${selectedWard.name}. Tap it again to clear, or choose another ward.`
                : 'Choose the ward where you are conducting releases and sustainings.'}
            </Text>

            {outstandingSelectableWards.length > 0 && (
              <View style={styles.wardGroup}>
                <View style={styles.wardGroupHeader}>
                  <Text style={styles.wardGroupTitle}>Needs Attention</Text>
                  <Text style={styles.wardGroupCount}>
                    {outstandingSelectableWards.length} ward{outstandingSelectableWards.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.wardPrimaryList}>
                  {outstandingSelectableWards.map((ward) => {
                    const active = selectedWardId === ward.id;
                    const wardRemainingCount = ward.totalCount - ward.doneCount;

                    return (
                      <Pressable
                        key={ward.id}
                        onPress={() => handleSelectWard(ward.id)}
                        testID={`sunday-ward-${ward.id}`}
                        style={({ pressed }) => [
                          styles.wardPrimaryChip,
                          active && styles.wardPrimaryChipActive,
                          pressed && styles.wardPrimaryChipPressed,
                        ]}
                      >
                        <View style={styles.wardPrimaryTextWrap}>
                          <Text style={[styles.wardPrimaryName, active && styles.wardPrimaryNameActive]}>
                            {ward.name}
                          </Text>
                          <Text style={[styles.wardPrimaryMeta, active && styles.wardPrimaryMetaActive]}>
                            {active
                              ? `${wardRemainingCount} ${wardRemainingCount === 1 ? 'item left' : 'items left'} · Tap again to clear`
                              : `${wardRemainingCount} ${wardRemainingCount === 1 ? 'item left' : 'items left'}`}
                          </Text>
                        </View>
                        <Ionicons
                          name={active ? 'close-circle' : 'chevron-forward'}
                          size={18}
                          color={active ? Colors.brand.primary : Colors.brand.midGray}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {completedWards.length > 0 && (
              <View style={styles.wardGroup}>
                <View style={styles.wardGroupHeader}>
                  <Text style={styles.completedGroupTitle}>Completed</Text>
                  <Text style={styles.wardGroupCount}>
                    {completedWards.length} ward{completedWards.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.completedWardGrid}>
                  {completedWards.map((ward) => {
                    const active = selectedWardId === ward.id;
                    return (
                      <AppInteractiveChip
                        key={ward.id}
                        label={ward.name}
                        onPress={() => handleSelectWard(ward.id)}
                        backgroundColor={active ? '#DCFCE7' : '#F0FDF4'}
                        textColor={active ? '#065F46' : '#166534'}
                        style={[styles.completedWardChip, active && styles.completedWardChipActive]}
                        testID={`sunday-completed-ward-${ward.id}`}
                      />
                    );
                  })}
                </View>
              </View>
            )}

            {!selectedWardId && (
              <AnimatedHandPrompt />
            )}
          </Animated.View>
        )}

        {!selectedWardId && showWardSelector && (
          <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.promptCard}>
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
                  scriptLanguage={scriptLanguage}
                  onChangeScriptLanguage={setScriptLanguage}
                />
              </Animated.View>
            )}

            {sustainingItems.length > 0 && (
              <Animated.View entering={FadeInDown.duration(300).delay(200)}>
                <TypeGroupCard
                  itemType="sustaining"
                  items={sustainingItems}
                  selectedWardId={selectedWardId}
                  scriptLanguage={scriptLanguage}
                  onChangeScriptLanguage={setScriptLanguage}
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
                <AppButton
                  label={
                    outstandingWardItems.length === 1
                      ? `Mark ${outstandingWardItems[0].item_type === 'release' ? 'Release' : 'Sustaining'} as Conducted`
                      : `Mark All ${outstandingWardItems.length} Items as Conducted`
                  }
                  onPress={markAllConducted}
                  loading={markingAll}
                  size="large"
                  style={styles.masterConductBtn}
                  testID="mark-all-conducted"
                />
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
                scriptLanguage={scriptLanguage}
                onChangeScriptLanguage={setScriptLanguage}
              />
            </Animated.View>
          )}

          {sustainingItems.length > 0 && (
            <Animated.View entering={FadeInDown.duration(300).delay(200)}>
              <TypeGroupCard
                itemType="sustaining"
                items={sustainingItems}
                selectedWardId={selectedWardId}
                scriptLanguage={scriptLanguage}
                onChangeScriptLanguage={setScriptLanguage}
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
              <AppButton
                label={
                  outstandingWardItems.length === 1
                    ? `Mark ${outstandingWardItems[0].item_type === 'release' ? 'Release' : 'Sustaining'} as Conducted`
                    : `Mark All ${outstandingWardItems.length} Items as Conducted`
                }
                onPress={markAllConducted}
                loading={markingAll}
                size="large"
                style={styles.masterConductBtn}
                testID="mark-all-conducted"
              />
            </Animated.View>
          ) : null}
          </>
        )}

        </View>
      </ScrollView>
    </>
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
    minWidth: 148,
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
  wardSelectorCard: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.brand.primary,
    ...webShadowRgba('rgba(1, 97, 131, 0.12)', 0, 4, 14),
    elevation: 4,
  },
  wardPrompt: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.brand.primary,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  wardHelperText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  handPrompt: {
    alignItems: 'center',
    marginTop: 16,
  },
  wardGroup: {
    marginTop: 16,
    gap: 10,
  },
  wardGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  wardGroupTitle: {
    fontSize: 14,
    color: '#92400E',
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  completedGroupTitle: {
    fontSize: 14,
    color: '#166534',
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  wardGroupCount: {
    fontSize: 13,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  wardPrimaryList: {
    gap: 10,
  },
  wardPrimaryChip: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFF9E8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  wardPrimaryChipActive: {
    borderColor: Colors.brand.primary,
    backgroundColor: '#E8F4F8',
  },
  wardPrimaryChipPressed: {
    opacity: 0.86,
  },
  wardPrimaryTextWrap: {
    flex: 1,
  },
  wardPrimaryName: {
    fontSize: 16,
    color: Colors.brand.dark,
    fontFamily: 'Inter_600SemiBold',
  },
  wardPrimaryNameActive: {
    color: Colors.brand.primary,
  },
  wardPrimaryMeta: {
    marginTop: 2,
    fontSize: 13,
    color: '#92400E',
    fontFamily: 'Inter_500Medium',
  },
  wardPrimaryMetaActive: {
    color: Colors.brand.primary,
  },
  completedWardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  completedWardChip: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 16,
  },
  completedWardChipActive: {
    borderColor: '#22C55E',
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
    fontSize: 15,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_500Medium',
  },
  reminderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  reminderSheet: {
    backgroundColor: Colors.brand.white,
    borderRadius: 20,
    padding: 20,
    ...webShadowRgba('rgba(15, 23, 42, 0.18)', 0, 10, 26),
    elevation: 12,
  },
  reminderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    marginBottom: 12,
  },
  reminderTitle: {
    fontSize: 18,
    color: Colors.brand.dark,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  reminderBody: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  reminderActions: {
    marginTop: 18,
    gap: 10,
  },
  reminderSecondaryBtn: {
    width: '100%',
  },
  reminderLeaveBtn: {
    width: '100%',
  },
  reminderPrimaryBtn: {
    width: '100%',
  },
  masterConductBtn: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 8,
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
