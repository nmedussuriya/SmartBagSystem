import React, { useState, useEffect, JSX } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { auth, database, ref, set } from './src/config/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

// Import screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import RegisterChildScreen from './src/screens/RegisterChildScreen';
import TimetableScreen from './src/screens/TimetableScreen';
import RegisterItemsScreen from './src/screens/InstructionsScreen';
import RegisterNfcScreen from './src/screens/RegisterNfcScreen';
import MonitorScreen from './src/screens/MonitorScreen';

// Import types
import { RootStackParamList } from './src/types';
import AboutScreen from './src/screens/InstructionsScreen';
import InstructionsScreen from './src/screens/InstructionsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      setUser(user);
      
      // ✅ Save parent ID to Firebase when user is logged in
      if (user) {
        try {
          await set(ref(database, 'current_parent'), user.uid);
          console.log("✅ Parent ID saved to Firebase on app start:", user.uid);
        } catch (error) {
          console.error("Error saving parent ID:", error);
        }
      }
      
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a6fa5" />
        <Text style={styles.loadingText}>Loading Smart Bag...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#4a6fa5' },
          headerTintColor: 'white',
          headerTitleStyle: { fontWeight: 'bold' }
        }}
      >
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Smart School Bag' }} />
            <Stack.Screen name="RegisterChild" component={RegisterChildScreen} options={{ title: 'Register Child' }} />
            <Stack.Screen name="Timetable" component={TimetableScreen} options={{ title: 'Set Timetable' }} />
            <Stack.Screen name="RegisterItems" component={RegisterItemsScreen} options={{ title: 'Register Items' }} />
            <Stack.Screen name="RegisterNfc" component={RegisterNfcScreen} options={{ title: 'Register NFC Tags' }} />
            <Stack.Screen name="Monitor" component={MonitorScreen} options={{ title: 'Monitor Bag' }} />
            <Stack.Screen name="Instructions" component={InstructionsScreen} options={{ title: 'Instructions' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});