import React, { useState, useEffect } from 'react';
import { JSX } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { auth, database, ref, get, child } from '../config/firebase';
import { signOut } from 'firebase/auth';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

interface MenuItem {
  id: string;
  title: string;
  description: string;
  screen: keyof RootStackParamList;
  icon: string;
  color: string;
}

export default function HomeScreen({ navigation }: HomeScreenProps): JSX.Element {
  const [childName, setChildName] = useState<string>('Loading...');
  const [childClass, setChildClass] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const user = auth.currentUser;

  const fetchChildData = async () => {
    if (!user) return;
    
    try {
      const activeChildSnapshot = await get(child(ref(database), 'active_child'));
      if (activeChildSnapshot.exists()) {
        const childId = activeChildSnapshot.val();
        const childSnapshot = await get(child(ref(database), `students/${user.uid}/${childId}`));
        if (childSnapshot.exists()) {
          const childData = childSnapshot.val();
          setChildName(childData.name || 'No name');
          setChildClass(childData.class || 'Not set');
        }
      } else {
        setChildName('No child registered');
        setChildClass('Please register a child');
      }
    } catch (error) {
      console.error(error);
      setChildName('Error loading');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChildData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchChildData();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              console.error('Sign out error:', error);
            }
          },
        },
      ]
    );
  };

  const menuItems: MenuItem[] = [
    { 
      id: 'RegisterChild', 
      title: 'Register Child', 
      description: 'Add your child\'s details to the system',
      screen: 'RegisterChild',
      icon: '👶',
      color: '#4a6fa5'
    },
    { 
      id: 'Timetable', 
      title: 'Set Timetable', 
      description: 'Create weekly schedule for your child',
      screen: 'Timetable',
      icon: '📅',
      color: '#e67e22'
    },
    { 
      id: 'RegisterNfc',
      title: 'Register NFC Tags', 
      description: 'Scan and register NFC tags using ESP32 bag',
      screen: 'RegisterNfc',
      icon: '🏷️',
      color: '#9b59b6'
    },
    { 
      id: 'Instructions',  // ✅ CHANGED from 'RegisterItems' to 'Instructions'
      title: '📖 Instructions', 
      description: 'How to use the Smart Bag system',
      screen: 'Instructions',
      icon: '📖',
      color: '#3498db'
    },
    { 
      id: 'Monitor', 
      title: 'Monitor Bag', 
      description: 'Track real-time scans and alerts',
      screen: 'Monitor',
      icon: '📊',
      color: '#e74c3c'
    },
  ];

  const handleNavigation = (screen: keyof RootStackParamList): void => {
    switch (screen) {
      case 'RegisterChild':
        navigation.navigate('RegisterChild');
        break;
      case 'Timetable':
        navigation.navigate('Timetable', { childId: undefined });
        break;
      case 'RegisterNfc':
        navigation.navigate('RegisterNfc');
        break;
      case 'Instructions':  // ✅ CHANGED from 'RegisterItems' to 'Instructions'
        navigation.navigate('Instructions');
        break;
      case 'Monitor':
        navigation.navigate('Monitor');
        break;
      default:
        console.warn('Unknown screen:', screen);
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
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Welcome Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.email?.split('@')[0] || 'Parent'}</Text>
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>🎒</Text>
          </View>
        </View>
      </View>

      {/* Child Profile Card */}
      <View style={styles.childCard}>
        <View style={styles.childAvatar}>
          <Text style={styles.childAvatarText}>
            {childName !== 'No child registered' ? childName.charAt(0).toUpperCase() : '👶'}
          </Text>
        </View>
        <View style={styles.childInfo}>
          <Text style={styles.childName}>{childName}</Text>
          <Text style={styles.childClass}>📚 {childClass}</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📅</Text>
          <Text style={styles.statNumber}>5</Text>
          <Text style={styles.statLabel}>Days/Week</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📚</Text>
          <Text style={styles.statNumber}>8</Text>
          <Text style={styles.statLabel}>Items/Day</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>✅</Text>
          <Text style={styles.statNumber}>100%</Text>
          <Text style={styles.statLabel}>Ready</Text>
        </View>
      </View>

      {/* Quick Actions Title */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      
      {/* Menu Items Grid */}
      <View style={styles.menuGrid}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuCard, { borderTopColor: item.color }]}
            onPress={() => handleNavigation(item.screen)}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: item.color + '20' }]}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
            </View>
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Text style={styles.menuDescription}>{item.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tips Section */}
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>💡 Quick Tips</Text>
        <Text style={styles.tipText}>• Register your child's ID card first</Text>
        <Text style={styles.tipText}>• Glue NFC tags on each book and item</Text>
        <Text style={styles.tipText}>• Set up weekly timetable for each day</Text>
        <Text style={styles.tipText}>• Monitor bag status in real-time</Text>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutIcon}>🚪</Text>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Footer Space */}
      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#4a6fa5',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: '#c8d6e5',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 2,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
  },
  childCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 20,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  childAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a6fa5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  childAvatarText: {
    fontSize: 28,
    color: 'white',
    fontWeight: 'bold',
  },
  childInfo: {
    flex: 1,
    marginLeft: 15,
  },
  childName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  childClass: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4a6fa5',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 20,
    marginTop: 25,
    marginBottom: 15,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  menuCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  menuIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  menuIcon: {
    fontSize: 24,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  menuDescription: {
    fontSize: 11,
    color: '#888',
    lineHeight: 14,
  },
  tipsCard: {
    backgroundColor: '#e8f4f8',
    marginHorizontal: 20,
    marginVertical: 20,
    padding: 18,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4a6fa5',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  tipText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
    lineHeight: 20,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff4444',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signOutIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  signOutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    height: 30,
  },
});