import React, { useState, useEffect, JSX } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { database, ref, set, get, child } from '../config/firebase';
import { auth } from '../config/firebase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, Student, TimetableFormData } from '../types';

type TimetableScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Timetable'>;

interface TimetableScreenProps {
  navigation: TimetableScreenNavigationProp;
  route?: { params?: { childId?: string } };
}

type DayType = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

const DAYS: DayType[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const PERIODS = ['period1', 'period2', 'period3', 'period4', 'period5'];

export default function TimetableScreen({ navigation, route }: TimetableScreenProps): JSX.Element {
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayType>('monday');
  const [formData, setFormData] = useState<TimetableFormData>({
    period1: '',
    period2: '',
    period3: '',
    period4: '',
    period5: '',
    essentials: ['Water Bottle', 'Lunch Box', 'Pencil Case'],
    extraItems: [],
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [showExtraInput, setShowExtraInput] = useState<boolean>(false);
  const [newExtraItem, setNewExtraItem] = useState<string>('');

  const userId = auth.currentUser?.uid;

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      loadTimetable();
    }
  }, [selectedChildId, selectedDay]);

  const loadChildren = async (): Promise<void> => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const snapshot = await get(child(ref(database), `students/${userId}`));
      if (snapshot.exists()) {
        const childrenList: Student[] = [];
        snapshot.forEach((childSnapshot) => {
          childrenList.push({
            id: childSnapshot.key as string,
            ...childSnapshot.val(),
          });
        });
        setChildren(childrenList);
        if (childrenList.length > 0 && !selectedChildId) {
          setSelectedChildId(childrenList[0].id!);
        }
        if (route?.params?.childId) {
          setSelectedChildId(route.params.childId);
        }
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadTimetable = async (): Promise<void> => {
    if (!selectedChildId) return;
    
    try {
      const snapshot = await get(
        child(ref(database), `timetable/${selectedChildId}/${selectedDay}`)
      );
      if (snapshot.exists()) {
        const data = snapshot.val();
        setFormData({
          period1: data.period1 || '',
          period2: data.period2 || '',
          period3: data.period3 || '',
          period4: data.period4 || '',
          period5: data.period5 || '',
          essentials: data.essentials || ['Water Bottle', 'Lunch Box', 'Pencil Case'],
          extraItems: data.extraItems || [],
        });
      } else {
        setFormData({
          period1: '',
          period2: '',
          period3: '',
          period4: '',
          period5: '',
          essentials: ['Water Bottle', 'Lunch Box', 'Pencil Case'],
          extraItems: [],
        });
      }
    } catch (error: any) {
      console.error(error);
    }
  };

  const handlePeriodChange = (period: string, value: string): void => {
    setFormData((prev) => ({ ...prev, [period]: value }));
  };

  const handleEssentialChange = (index: number, value: string): void => {
    const newEssentials = [...formData.essentials];
    newEssentials[index] = value;
    setFormData((prev) => ({ ...prev, essentials: newEssentials }));
  };

  const addEssential = (): void => {
    setFormData((prev) => ({
      ...prev,
      essentials: [...prev.essentials, 'New Item'],
    }));
  };

  const removeEssential = (index: number): void => {
    const newEssentials = formData.essentials.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, essentials: newEssentials }));
  };

  // ✅ Extra Items functions
  const addExtraItem = (): void => {
    if (newExtraItem.trim() === '') {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      extraItems: [...prev.extraItems, newExtraItem.trim()],
    }));
    setNewExtraItem('');
    setShowExtraInput(false);
  };

  const removeExtraItem = (index: number): void => {
    const newExtraItems = formData.extraItems.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, extraItems: newExtraItems }));
  };

  // ✅ Save timetable - THIS AUTO-GENERATES extraItems IN FIREBASE!
  const saveTimetable = async (): Promise<void> => {
    if (!selectedChildId) {
      Alert.alert('Error', 'Please select a child');
      return;
    }

    setSaving(true);
    try {
      // Debug log
      console.log("💾 Saving timetable for:", selectedChildId, selectedDay);
      console.log("Extra items to save:", formData.extraItems);
      
      const dataToSave = {
        period1: formData.period1,
        period2: formData.period2,
        period3: formData.period3,
        period4: formData.period4,
        period5: formData.period5,
        essentials: formData.essentials,
        extraItems: formData.extraItems,  // ← THIS CREATES THE FIELD IN FIREBASE!
        last_updated: new Date().toISOString(),
      };
      
      await set(ref(database, `timetable/${selectedChildId}/${selectedDay}`), dataToSave);
      
      Alert.alert('Success', `Timetable for ${selectedDay} saved!`);
    } catch (error: any) {
      console.error("Save error:", error);
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4a6fa5" />
      </View>
    );
  }

  if (children.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No children registered yet</Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => navigation.navigate('RegisterChild')}
        >
          <Text style={styles.emptyButtonText}>Register a Child</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Child Selector */}
      <Text style={styles.label}>Select Child</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childContainer}>
        {children.map((child) => (
          <TouchableOpacity
            key={child.id}
            style={[styles.childButton, selectedChildId === child.id && styles.childButtonActive]}
            onPress={() => setSelectedChildId(child.id!)}
          >
            <Text style={[styles.childText, selectedChildId === child.id && styles.childTextActive]}>
              {child.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Day Selector */}
      <Text style={styles.label}>Select Day</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayContainer}>
        {DAYS.map((day) => (
          <TouchableOpacity
            key={day}
            style={[styles.dayButton, selectedDay === day && styles.dayButtonActive]}
            onPress={() => setSelectedDay(day)}
          >
            <Text style={[styles.dayText, selectedDay === day && styles.dayTextActive]}>
              {day.charAt(0).toUpperCase() + day.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Period Subjects */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Subjects for {selectedDay}</Text>
        {PERIODS.map((period, index) => (
          <View key={period} style={styles.periodRow}>
            <Text style={styles.periodLabel}>Period {index + 1}</Text>
            <TextInput
              style={styles.subjectInput}
              placeholder="e.g., Sinhala, Maths, English"
              placeholderTextColor="#999"
              value={formData[period as keyof TimetableFormData] as string}
              onChangeText={(value) => handlePeriodChange(period, value)}
            />
          </View>
        ))}
      </View>

      {/* Essentials */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Always Needed Items</Text>
        {formData.essentials.map((item, index) => (
          <View key={index} style={styles.essentialRow}>
            <TextInput
              style={styles.essentialInput}
              value={item}
              onChangeText={(value) => handleEssentialChange(index, value)}
            />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeEssential(index)}
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        
        <TouchableOpacity style={styles.addButton} onPress={addEssential}>
          <Text style={styles.addButtonText}>+ Add Essential Item</Text>
        </TouchableOpacity>
      </View>

      {/* ✅ Extra Items Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>➕ Extra Items for {selectedDay}</Text>
        <Text style={styles.extraHint}>
          Add items the child wants to bring extra (e.g., "History Book", "Drawing Book")
        </Text>
        
        {formData.extraItems.length > 0 ? (
          formData.extraItems.map((item, index) => (
            <View key={index} style={styles.extraRow}>
              <Text style={styles.extraItemText}>📌 {item}</Text>
              <TouchableOpacity
                style={styles.removeExtraButton}
                onPress={() => removeExtraItem(index)}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.noExtraText}>No extra items added for this day</Text>
        )}

        {showExtraInput ? (
          <View style={styles.addExtraRow}>
            <TextInput
              style={styles.extraInput}
              placeholder="e.g., History Book"
              placeholderTextColor="#999"
              value={newExtraItem}
              onChangeText={setNewExtraItem}
              autoFocus
            />
            <TouchableOpacity style={styles.confirmExtraButton} onPress={addExtraItem}>
              <Text style={styles.confirmExtraText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cancelExtraButton} 
              onPress={() => {
                setShowExtraInput(false);
                setNewExtraItem('');
              }}
            >
              <Text style={styles.cancelExtraText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.addExtraButton} 
            onPress={() => setShowExtraInput(true)}
          >
            <Text style={styles.addExtraButtonText}>+ Add Extra Item</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Save Button - MUST CLICK TO SAVE TO FIREBASE */}
      <TouchableOpacity style={styles.saveButton} onPress={saveTimetable} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : '💾 Save Timetable'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#4a6fa5',
    padding: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
    marginTop: 15,
  },
  childContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  childButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  childButtonActive: {
    backgroundColor: '#4a6fa5',
  },
  childText: {
    fontSize: 14,
    color: '#333',
  },
  childTextActive: {
    color: 'white',
  },
  dayContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  dayButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  dayButtonActive: {
    backgroundColor: '#4a6fa5',
  },
  dayText: {
    fontSize: 12,
    color: '#333',
  },
  dayTextActive: {
    color: 'white',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  periodLabel: {
    width: 70,
    fontSize: 14,
    color: '#666',
  },
  subjectInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  essentialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  essentialInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginRight: 10,
  },
  removeButton: {
    backgroundColor: '#ff4444',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#4a6fa5',
    fontWeight: 'bold',
  },
  extraHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
  },
  extraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  extraItemText: {
    fontSize: 14,
    color: '#333',
  },
  removeExtraButton: {
    backgroundColor: '#ff4444',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noExtraText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    padding: 10,
  },
  addExtraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  extraInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginRight: 8,
  },
  confirmExtraButton: {
    backgroundColor: '#4caf50',
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmExtraText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelExtraButton: {
    backgroundColor: '#ff4444',
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  cancelExtraText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addExtraButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  addExtraButtonText: {
    color: '#4caf50',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#4a6fa5',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 30,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});