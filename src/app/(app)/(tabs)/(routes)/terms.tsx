import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { WEB_BOTTOM_INSET } from '@/constants/layout';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing and using the SurreyAlign Companion App ("the App"), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, please discontinue use of the App immediately.',
  },
  {
    title: '2. Description of Service',
    body: 'The App is a private, internal leadership coordination tool designed exclusively for authorized leaders of the Surrey British Columbia Stake of The Church of Jesus Christ of Latter-day Saints. It provides mobile access to coordination features including agendas, assignments, callings directories, and leadership check-ins. The App is a companion to the SurreyAlign.org web platform and does not operate as a standalone service.',
  },
  {
    title: '3. Authorized Use',
    body: 'Access to the App is restricted to individuals who have been granted credentials by a stake administrator. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Sharing your credentials with unauthorized individuals is prohibited.',
  },
  {
    title: '4. Data and Privacy',
    body: 'The App connects to SurreyAlign.org as its sole data source. All leadership data, meeting agendas, assignments, and personal information displayed in the App is managed and stored by SurreyAlign.org. The App stores only your authentication token and cached profile information locally on your device for session management. No personal data is collected, sold, or shared with third parties.',
  },
  {
    title: '5. Content and Accuracy',
    body: 'While we strive to keep all information accurate and up to date, the App is provided on an "as is" basis. We make no warranties or representations regarding the completeness, accuracy, or reliability of any content displayed. Information such as callings, agendas, and assignments reflects data entered by authorized leaders and administrators.',
  },
  {
    title: '6. Acceptable Use',
    body: 'You agree to use the App solely for its intended purpose of supporting stake and ward leadership coordination. You shall not: (a) attempt to gain unauthorized access to any part of the App or its connected systems; (b) use the App for any unlawful, harmful, or inappropriate purpose; (c) copy, distribute, or modify the App or its content without authorization; (d) use the App to transmit spam, malware, or other harmful content.',
  },
  {
    title: '7. Intellectual Property',
    body: 'The SurreyAlign platform — including its complete source code, software architecture, database design, API layer, ALIGN stewardship framework, companion mobile application, and all associated documentation — is the original intellectual property of its developer. The developer retains sole ownership of the codebase, system design, and the ingenuity embodied in the platform\u2019s conception and implementation. No transfer of intellectual property rights is implied by the provision of this App to authorized users. The ALIGN framework, branding, visual identity, and associated materials are proprietary creations used exclusively for the benefit of the Surrey British Columbia Stake. Unauthorized reproduction, distribution, reverse engineering, or derivative use of any part of the platform is strictly prohibited without the express written consent of the developer.',
  },
  {
    title: '8. Limitation of Liability',
    body: 'To the fullest extent permitted by applicable law, the App and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the App. This includes but is not limited to loss of data, unauthorized access, or service interruptions.',
  },
  {
    title: '9. Service Availability',
    body: 'We do not guarantee uninterrupted access to the App. The service may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control. We reserve the right to modify, suspend, or discontinue any part of the App at any time without prior notice.',
  },
  {
    title: '10. Account Deactivation',
    body: 'Stake administrators may deactivate your account at any time if your calling or role changes, or if your account is no longer required. Upon deactivation, your access to the App will be revoked and any locally cached data will become inaccessible.',
  },
  {
    title: '11. Changes to Terms',
    body: 'We reserve the right to update these Terms of Service at any time. Continued use of the App after changes are posted constitutes acceptance of the revised terms. We encourage you to review these terms periodically.',
  },
  {
    title: '12. Disclaimer',
    body: 'This App is not an official product of The Church of Jesus Christ of Latter-day Saints. It is a locally developed tool created to support leadership coordination within the Surrey British Columbia Stake. Church policies, handbooks, and official resources take precedence over any content within this App.\n\nThe App is provided on an \u201cas is\u201d and \u201cas available\u201d basis, without warranties of any kind, whether express, implied, or statutory. The developer and contributors make no representations or warranties regarding the accuracy, reliability, completeness, or timeliness of any information displayed within the App. To the fullest extent permitted by law, the developer disclaims all warranties, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. Your use of the App is at your sole risk. The developer shall not be held responsible for any decisions made or actions taken based on information presented through the App.',
  },
  {
    title: '13. Contact',
    body: 'For questions, concerns, or feedback regarding the App or these Terms of Service, please contact your stake technology administrator or visit SurreyAlign.org.',
  },
];

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const webBottomInset = WEB_BOTTOM_INSET;

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
        <Text style={styles.lastUpdated}>Last updated: February 2026</Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  lastUpdated: {
    fontSize: 14,
    color: Colors.brand.midGray,
    marginBottom: 20,
    fontFamily: 'Inter_400Regular',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.brand.black,
    marginBottom: 6,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionBody: {
    fontSize: 16,
    color: Colors.brand.darkGray,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
});
