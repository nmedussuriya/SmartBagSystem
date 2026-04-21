import React, { JSX, useState } from 'react';
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
import type { RootStackParamList, ChildFormData } from '../types';

type RegisterChildScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RegisterChild'>;

interface RegisterChildScreenProps {
  navigation: RegisterChildScreenNavigationProp;
}

export default function RegisterChildScreen({ navigation }: RegisterChildScreenProps): JSX.Element {
  const [formData, setFormData] = useState<ChildFormData>({
    name: '',
    class: '',
    rfid_card: '',
  });
  const [loading, setLoading] = useState<boolean>(false);

  const userId = auth.currentUser?.uid;

  const handleInputChange = (field: keyof ChildFormData, value: string): void => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const saveChild = async (): Promise<void> => {
    if (!formData.name || !formData.class) {
      Alert.alert('Error', 'Please fill in child name and class');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const childId = formData.name.replace(/\s/g, '_').toLowerCase();
      
      // Check if child already exists
      const snapshot = await get(child(ref(database), `students/${userId}/${childId}`));
      if (snapshot.exists()) {
        Alert.alert('Error', 'A child with this name already exists');
        return;
      }
      
      // Save to Firebase
      await set(ref(database, `students/${userId}/${childId}`), {
        name: formData.name,
        class: formData.class,
        rfid_card: formData.rfid_card || 'not_registered',
        registered_date: new Date().toISOString(),
        parent_id: userId,
      });
      
      Alert.alert('Success', `${formData.name} has been registered!`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Register Your Child</Text>
      <Text style={styles.subtitle}>Add your child's information to get started</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Child's Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Little Kid"
          placeholderTextColor="#999"
          value={formData.name}
          onChangeText={(value) => handleInputChange('name', value)}
          editable={!loading}
        />
        
        <Text style={styles.label}>Class/Grade *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Grade 1, 10A"
          placeholderTextColor="#999"
          value={formData.class}
          onChangeText={(value) => handleInputChange('class', value)}
          editable={!loading}
        />
        
        <Text style={styles.label}>RFID Card ID (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Scan card or enter UID"
          placeholderTextColor="#999"
          value={formData.rfid_card}
          onChangeText={(value) => handleInputChange('rfid_card', value)}
          editable={!loading}
        />
        
        <Text style={styles.note}>
          💡 Tip: You can register the RFID card now or later from the ESP32 bag.
          The bag will scan the card to identify your child.
        </Text>
      </View>
      
      <TouchableOpacity style={styles.button} onPress={saveChild} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Register Child</Text>
        )}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  note: {
    fontSize: 12,
    color: '#888',
    marginTop: 20,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#4a6fa5',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});