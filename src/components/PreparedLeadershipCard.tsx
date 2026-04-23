import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { webShadowRgba } from '@/lib/web-styles';
import Colors from '@/constants/colors';
import AppStatusBadge from '@/components/ui/AppStatusBadge';
import { leadershipArtifactTone } from '@/lib/leadership-intelligence';

interface PreparedLeadershipCardProps {
  eyebrow?: string;
  title: string;
  summary: string;
  question?: string | null;
  focus?: string | null;
  bullets?: string[];
  note?: string | null;
  generatedLabel?: string | null;
  statusLabel?: string | null;
  statusTone?: string | null;
  actionLabel?: string | null;
  onAction?: (() => void) | null;
  icon?: keyof typeof Ionicons.glyphMap;
  compact?: boolean;
  testID?: string;
}

export default function PreparedLeadershipCard({
  eyebrow = 'Prepared for you',
  title,
  summary,
  question,
  focus,
  bullets = [],
  note,
  generatedLabel,
  statusLabel,
  statusTone,
  actionLabel,
  onAction,
  icon = 'sparkles-outline',
  compact = false,
  testID,
}: PreparedLeadershipCardProps) {
  const tone = leadershipArtifactTone(statusTone);
  const hasFooter = Boolean(generatedLabel || note || (actionLabel && onAction));

  return (
    <View style={[styles.card, compact ? styles.cardCompact : null]} testID={testID}>
      <View style={styles.header}>
        <View style={styles.headerMain}>
          <View style={[styles.iconWrap, compact && styles.iconWrapCompact]}>
            <Ionicons name={icon} size={compact ? 15 : 17} color={Colors.brand.primary} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, compact && styles.eyebrowCompact]}>{eyebrow}</Text>
            <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
          </View>
        </View>
        {statusLabel ? (
          <AppStatusBadge
            label={statusLabel}
            backgroundColor={tone.backgroundColor}
            textColor={tone.textColor}
            style={compact ? styles.badgeCompact : undefined}
          />
        ) : null}
      </View>

      <Text style={[styles.summary, compact && styles.summaryCompact]}>{summary}</Text>

      {question ? (
        <View style={[styles.questionCard, compact && styles.questionCardCompact]}>
          <Ionicons name="help-circle-outline" size={compact ? 15 : 16} color={Colors.brand.primary} />
          <Text style={[styles.questionText, compact && styles.questionTextCompact]}>{question}</Text>
        </View>
      ) : null}

      {focus ? (
        <Text style={[styles.focusText, compact && styles.focusTextCompact]}>{focus}</Text>
      ) : null}

      {bullets.length > 0 ? (
        <View style={styles.bullets}>
          {bullets.map((bullet, index) => (
            <View key={`${bullet}-${index}`} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={[styles.bulletText, compact && styles.bulletTextCompact]}>{bullet}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {hasFooter ? (
        <View style={styles.footer}>
          <View style={styles.footerCopy}>
            {note ? <Text style={styles.noteText}>{note}</Text> : null}
            {generatedLabel ? <Text style={styles.generatedText}>{generatedLabel}</Text> : null}
          </View>
          {actionLabel && onAction ? (
            <Pressable
              onPress={onAction}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.actionLabel}>{actionLabel}</Text>
              <Ionicons name="chevron-forward" size={15} color={Colors.brand.primary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.brand.lightGray,
    ...webShadowRgba(Colors.light.cardShadow, 0, 2, 8),
    elevation: 1,
  },
  cardCompact: {
    borderRadius: 14,
    padding: 14,
    gap: 10,
    backgroundColor: Colors.brand.accentWarm,
    borderColor: '#D6E9F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Colors.brand.primary,
  },
  eyebrowCompact: {
    fontSize: 11,
  },
  title: {
    fontSize: 18,
    lineHeight: 23,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: Colors.brand.black,
  },
  titleCompact: {
    fontSize: 16,
    lineHeight: 21,
  },
  badgeCompact: {
    alignSelf: 'flex-start',
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_500Medium',
  },
  summaryCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.brand.accent,
  },
  questionCardCompact: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.primaryDark,
    fontFamily: 'Inter_500Medium',
  },
  questionTextCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  focusText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.black,
    fontFamily: 'Inter_500Medium',
  },
  focusTextCompact: {
    fontSize: 13,
    lineHeight: 19,
  },
  bullets: {
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: 6,
    backgroundColor: Colors.brand.primary,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_400Regular',
  },
  bulletTextCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 4,
  },
  footerCopy: {
    flex: 1,
    gap: 2,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.brand.darkGray,
    fontFamily: 'Inter_500Medium',
  },
  generatedText: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.brand.midGray,
    fontFamily: 'Inter_400Regular',
  },
  actionButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.brand.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButtonPressed: {
    opacity: 0.84,
  },
  actionLabel: {
    fontSize: 13,
    color: Colors.brand.primary,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
});
