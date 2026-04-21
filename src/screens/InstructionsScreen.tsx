import React, { useState, useEffect, JSX } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { auth, database, ref, get, child } from '../config/firebase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type InstructionsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Instructions'>;

interface InstructionsScreenProps {
  navigation: InstructionsScreenNavigationProp;
}

export default function InstructionsScreen({ navigation }: InstructionsScreenProps): JSX.Element {
  const [stats, setStats] = useState({
    totalChildren: 0,
    totalItems: 0,
    totalScans: 0,
    appVersion: '1.0.0',
  });
  const [loading, setLoading] = useState(true);

  const userId = auth.currentUser?.uid;

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Get children count
      const childrenSnap = await get(child(ref(database), `students/${userId}`));
      const totalChildren = childrenSnap.exists() ? Object.keys(childrenSnap.val()).length : 0;

      // Get items count
      const itemsSnap = await get(child(ref(database), `items_catalog/${userId}`));
      let totalItems = 0;
      if (itemsSnap.exists()) {
        const items = itemsSnap.val();
        for (const childId in items) {
          totalItems += Object.keys(items[childId]).length;
        }
      }

      setStats({
        totalChildren,
        totalItems,
        totalScans: 0,
        appVersion: '2.0.0',
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4a6fa5" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* App Logo & Title */}
      <View style={styles.header}>
        <Text style={styles.logo}>🎒</Text>
        <Text style={styles.appName}>Smart School Bag</Text>
        <Text style={styles.version}>Version {stats.appVersion}</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalChildren}</Text>
          <Text style={styles.statLabel}>Children</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalItems}</Text>
          <Text style={styles.statLabel}>Items Registered</Text>
        </View>
      </View>

      {/* About Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📖 About This App</Text>
        <Text style={styles.description}>
          Smart School Bag helps parents ensure their children pack all necessary items for school. 
          Using NFC tags and a smart bag, you can track what your child packs and get alerts 
          when something is missing.
        </Text>
      </View>

      {/* Features Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>✨ Features</Text>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🏷️</Text>
          <Text style={styles.featureText}>Register NFC tags for books and essentials</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>📅</Text>
          <Text style={styles.featureText}>Set weekly timetable for each child</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>📊</Text>
          <Text style={styles.featureText}>Real-time monitoring of scanned items</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🔔</Text>
          <Text style={styles.featureText}>Instant alerts for missing items</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>➕</Text>
          <Text style={styles.featureText}>Add extra items for special days</Text>
        </View>
      </View>

      {/* How It Works */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ How It Works</Text>
        <Text style={styles.stepNumber}>1</Text>
        <Text style={styles.stepText}>Register your child's details</Text>
        <Text style={styles.stepNumber}>2</Text>
        <Text style={styles.stepText}>Glue NFC tags on books and items</Text>
        <Text style={styles.stepNumber}>3</Text>
        <Text style={styles.stepText}>Set weekly timetable in the app</Text>
        <Text style={styles.stepNumber}>4</Text>
        <Text style={styles.stepText}>Child scans items on the smart bag</Text>
        <Text style={styles.stepNumber}>5</Text>
        <Text style={styles.stepText}>You get notified if anything is missing!</Text>
      </View>

      {/* Tech Stack */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🛠️ Technology</Text>
        <View style={styles.techItem}>
          <Text style={styles.techIcon}>📱</Text>
          <Text style={styles.techText}>React Native (Expo)</Text>
        </View>
        <View style={styles.techItem}>
          <Text style={styles.techIcon}>🔥</Text>
          <Text style={styles.techText}>Firebase Realtime Database</Text>
        </View>
        <View style={styles.techItem}>
          <Text style={styles.techIcon}>🔌</Text>
          <Text style={styles.techText}>ESP32 Microcontroller</Text>
        </View>
        <View style={styles.techItem}>
          <Text style={styles.techIcon}>🏷️</Text>
          <Text style={styles.techText}>RFID-RC522 + NFC Tags</Text>
        </View>
      </View>

      {/* Contact / Support */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📧 Support</Text>
        <Text style={styles.supportText}>
          For questions or support, please contact:
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL('mailto:support@smartschoolbag.com')}>
          <Text style={styles.emailLink}>support@smartschoolbag.com</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          © 2024 Smart School Bag. All rights reserved.
        </Text>
        <Text style={styles.footerText}>
          Made with ❤️ for better school mornings
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#4a6fa5',
    padding: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  logo: {
    fontSize: 60,
    marginBottom: 10,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  version: {
    fontSize: 12,
    color: '#c8d6e5',
    marginTop: 5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: -20,
    marginBottom: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4a6fa5',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  card: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 12,
    width: 35,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  stepNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4a6fa5',
    marginTop: 10,
    marginBottom: 5,
  },
  stepText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    marginBottom: 10,
  },
  techItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  techIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 35,
  },
  techText: {
    fontSize: 14,
    color: '#555',
  },
  supportText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  emailLink: {
    fontSize: 16,
    color: '#4a6fa5',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#aaa',
    marginVertical: 2,
  },
});