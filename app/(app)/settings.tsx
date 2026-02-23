import React from 'react';
import { webShadowRgba } from '@/lib/web-styles';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import Colors from '@/constants/colors';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + webBottomInset + 32,
          paddingHorizontal: 20,
          paddingTop: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="person-outline" size={20} color={Colors.brand.midGray} />
              <Text style={styles.rowLabel}>Signed in as</Text>
            </View>
            <Text style={styles.rowValue} numberOfLines={1}>{user?.email || '—'}</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="business-outline" size={20} color={Colors.brand.midGray} />
              <Text style={styles.rowLabel}>Stake</Text>
            </View>
            <Text style={styles.rowValue} numberOfLines={1}>{user?.stake || '—'}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="notifications-outline" size={20} color={Colors.brand.midGray} />
              <Text style={styles.rowLabel}>Push Notifications</Text>
            </View>
            <Text style={[styles.rowValue, { color: Colors.brand.midGray, fontStyle: 'italic' }]}>Coming soon</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="moon-outline" size={20} color={Colors.brand.midGray} />
              <Text style={styles.rowLabel}>Dark Mode</Text>
            </View>
            <Text style={[styles.rowValue, { color: Colors.brand.midGray, fontStyle: 'italic' }]}>Coming soon</Text>
          </View>
        </View>


        <Text style={styles.sectionLabel}>Data</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="cloud-outline" size={20} color={Colors.brand.midGray} />
              <Text style={styles.rowLabel}>Data Source</Text>
            </View>
            <Text style={styles.rowValue}>SurreyAlign.org</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.brand.midGray} />
              <Text style={styles.rowLabel}>Session</Text>
            </View>
            <Text style={[styles.rowValue, { color: Colors.brand.success }]}>Active</Text>
          </View>
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.brand.midGray,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  card: {
    backgroundColor: Colors.brand.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    ...webShadowRgba('rgba(1, 97, 131, 0.06)', 0, 2, 8),
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    color: Colors.brand.dark,
    fontFamily: 'Inter_400Regular',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.brand.darkGray,
    maxWidth: '45%',
    textAlign: 'right' as const,
    fontFamily: 'Inter_500Medium',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.brand.lightGray,
    marginLeft: 46,
  },
  hintText: {
    fontSize: 12,
    color: Colors.brand.midGray,
    marginBottom: 16,
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
});
