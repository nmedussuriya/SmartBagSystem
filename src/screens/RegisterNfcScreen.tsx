import React, { useState, useEffect, JSX } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { database, ref, set, onValue, get, child } from '../config/firebase';
import { auth } from '../config/firebase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type RegisterNfcScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RegisterNfc'>;

interface RegisterNfcScreenProps {
  navigation: RegisterNfcScreenNavigationProp;
}

const COMMON_BOOKS = [
  'Sinhala Book',
  'Maths Book',
  'English Book',
  'Science Book',
  'Buddhist Book',
  'History Book',
];

const COMMON_ESSENTIALS = [
  'Water Bottle',
  'Lunch Box',
  'Pencil Case',
];

export default function RegisterNfcScreen({ navigation }: RegisterNfcScreenProps): JSX.Element {
  const [isWaitingForTag, setIsWaitingForTag] = useState<boolean>(false);
  const [detectedTagId, setDetectedTagId] = useState<string>('');
  const [selectedItemType, setSelectedItemType] = useState<'book' | 'essential'>('book');
  const [selectedItemName, setSelectedItemName] = useState<string>('');
  const [customItemName, setCustomItemName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [registeredItems, setRegisteredItems] = useState<any[]>([]);
  const [childId, setChildId] = useState<string>('');
  const [childName, setChildName] = useState<string>('');

  const userId = auth.currentUser?.uid;

  // Get current child for this parent (only one child per parent)
  useEffect(() => {
    const fetchChild = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        
        // Get the first (and only) child for this parent
        const studentsSnapshot = await get(child(ref(database), `students/${user.uid}`));
        if (studentsSnapshot.exists()) {
          const students = studentsSnapshot.val();
          const firstChildId = Object.keys(students)[0];
          const firstChild = students[firstChildId];
          
          setChildId(firstChildId);
          setChildName(firstChild.name || 'Child');
          
          // Set as active child
          await set(ref(database, 'active_child'), firstChildId);
        }
      } catch (error) {
        console.error('Error fetching child:', error);
      }
    };
    
    fetchChild();
  }, []);

  // Load items for THIS child only
  const loadRegisteredItems = async () => {
    if (!userId || !childId) return;
    
    try {
      const snapshot = await get(child(ref(database), `items_catalog/${userId}/${childId}`));
      if (snapshot.exists()) {
        const items: any[] = [];
        snapshot.forEach((item) => {
          items.push({
            tagId: item.key,
            ...item.val(),
          });
        });
        setRegisteredItems(items);
      } else {
        setRegisteredItems([]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (childId) {
      loadRegisteredItems();
    }
  }, [childId]);

  // Listen for tag detection from ESP32
  useEffect(() => {
    const tagRef = ref(database, 'pending_registration/tag_id');
    const unsubscribe = onValue(tagRef, (snapshot) => {
      const tagId = snapshot.val();
      if (tagId && tagId !== '' && isWaitingForTag) {
        setDetectedTagId(tagId);
        setIsWaitingForTag(false);
        set(ref(database, 'pending_registration/tag_id'), '');
        Alert.alert('Tag Detected!', `Tag ID: ${tagId}\nNow select what this item is.`);
      }
    });

    return () => unsubscribe();
  }, [isWaitingForTag]);

  const startRegistration = async () => {
    if (!childId) {
      Alert.alert('Error', 'No child found. Please register a child first.');
      return;
    }
    
    setIsWaitingForTag(true);
    setDetectedTagId('');
    
    await set(ref(database, 'commands/register_tag'), true);
    await set(ref(database, 'commands/register_tag_status'), 'listening');
    
    Alert.alert(
      'Ready to Scan',
      `Tap your NFC tag on the ESP32 bag reader to register for ${childName}`,
      [{ text: 'Cancel', onPress: cancelRegistration, style: 'cancel' }]
    );
    
    setTimeout(() => {
      if (isWaitingForTag) {
        cancelRegistration();
        Alert.alert('Timeout', 'No tag detected. Please try again.');
      }
    }, 30000);
  };

  const cancelRegistration = async () => {
    setIsWaitingForTag(false);
    await set(ref(database, 'commands/register_tag'), false);
    await set(ref(database, 'commands/register_tag_status'), 'idle');
    await set(ref(database, 'pending_registration/tag_id'), '');
    setDetectedTagId('');
  };

  const saveItemToFirebase = async () => {
    const itemName = selectedItemType === 'book' ? selectedItemName : customItemName;
    
    if (!itemName) {
      Alert.alert('Error', 'Please select or enter an item name');
      return;
    }

    setIsLoading(true);
    
    try {
      // Save to child-specific path: items_catalog/{parentId}/{childId}/{tagId}
      await set(ref(database, `items_catalog/${userId}/${childId}/${detectedTagId}`), {
        name: itemName,
        type: selectedItemType,
        registered_date: new Date().toISOString(),
      });
      
      Alert.alert('Success', `${itemName} has been registered for ${childName}!`);
      
      setDetectedTagId('');
      setSelectedItemName('');
      setCustomItemName('');
      setSelectedItemType('book');
      
      await loadRegisteredItems();
      
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Register NFC Tags</Text>
      <Text style={styles.subtitle}>
        👶 Child: {childName || 'Loading...'}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 How to Register</Text>
        <Text style={styles.instruction}>
          1. Click "Start Scanning"{'\n'}
          2. Tap your NFC tag on the ESP32 bag reader{'\n'}
          3. Select what this item is (Book or Essential){'\n'}
          4. Click "Save Item"{'\n'}
          5. Tag is now registered for {childName}
        </Text>
      </View>

      {/* Start Scanning Button */}
      {!detectedTagId && childId && (
        <TouchableOpacity
          style={[styles.scanButton, isWaitingForTag && styles.scanningButton]}
          onPress={startRegistration}
          disabled={isWaitingForTag}
        >
          {isWaitingForTag ? (
            <>
              <ActivityIndicator color="white" />
              <Text style={styles.scanButtonText}> Waiting for tag...</Text>
            </>
          ) : (
            <Text style={styles.scanButtonText}>🔍 Start Scanning</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Registration Form */}
      {detectedTagId && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏷️ Tag Detected</Text>
          <Text style={styles.tagId}>ID: {detectedTagId}</Text>
          <Text style={styles.registeringFor}>Registering for: {childName}</Text>
          
          <Text style={styles.label}>Item Type:</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeButton, selectedItemType === 'book' && styles.typeButtonActive]}
              onPress={() => setSelectedItemType('book')}
            >
              <Text style={styles.typeText}>📚 Book</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, selectedItemType === 'essential' && styles.typeButtonActive]}
              onPress={() => setSelectedItemType('essential')}
            >
              <Text style={styles.typeText}>🎒 Essential</Text>
            </TouchableOpacity>
          </View>

          {selectedItemType === 'book' && (
            <>
              <Text style={styles.label}>Select Book:</Text>
              {COMMON_BOOKS.map((book) => (
                <TouchableOpacity
                  key={book}
                  style={[styles.itemOption, selectedItemName === book && styles.itemOptionSelected]}
                  onPress={() => setSelectedItemName(book)}
                >
                  <Text style={styles.itemName}>{book}</Text>
                  {selectedItemName === book && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </>
          )}

          {selectedItemType === 'essential' && (
            <>
              <Text style={styles.label}>Select Essential:</Text>
              {COMMON_ESSENTIALS.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.itemOption, customItemName === item && styles.itemOptionSelected]}
                  onPress={() => setCustomItemName(item)}
                >
                  <Text style={styles.itemName}>{item}</Text>
                  {customItemName === item && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
              
              <Text style={styles.label}>Or Custom Item:</Text>
              <TouchableOpacity
                style={styles.customButton}
                onPress={() => {
                  Alert.prompt('Custom Item', 'Enter item name', (text) => {
                    if (text) setCustomItemName(text);
                  });
                }}
              >
                <Text style={styles.customButtonText}>+ Add Custom Item</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveItemToFirebase}
            disabled={isLoading || (!selectedItemName && !customItemName)}
          >
            <Text style={styles.saveButtonText}>
              {isLoading ? 'Saving...' : '💾 Save Item'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={cancelRegistration}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Registered Items List */}
      {registeredItems.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            ✅ {childName}'s Registered Items ({registeredItems.length})
          </Text>
          {registeredItems.map((item, index) => (
            <View key={index} style={styles.registeredItem}>
              <Text style={styles.registeredIcon}>
                {item.type === 'book' ? '📚' : '🎒'}
              </Text>
              <Text style={styles.registeredName}>{item.name}</Text>
              <Text style={styles.registeredTag}>{item.tagId.substring(0, 8)}...</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#4a6fa5',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  scanButton: {
    backgroundColor: '#4a6fa5',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  scanningButton: {
    backgroundColor: '#ff9800',
  },
  scanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tagId: {
    fontSize: 14,
    fontFamily: 'monospace',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  registeringFor: {
    fontSize: 14,
    color: '#4a6fa5',
    marginBottom: 15,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginTop: 10,
  },
  typeRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  typeButton: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  typeButtonActive: {
    backgroundColor: '#4a6fa5',
  },
  typeText: {
    color: '#333',
  },
  itemOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fafafa',
  },
  itemOptionSelected: {
    borderColor: '#4a6fa5',
    backgroundColor: '#e8f0fe',
  },
  itemName: {
    fontSize: 14,
    color: '#333',
  },
  checkmark: {
    fontSize: 16,
    color: '#4a6fa5',
    fontWeight: 'bold',
  },
  customButton: {
    padding: 10,
    alignItems: 'center',
    marginTop: 5,
  },
  customButtonText: {
    color: '#4a6fa5',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#4caf50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#999',
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  registeredItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  registeredIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  registeredName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  registeredTag: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#999',
  },
});