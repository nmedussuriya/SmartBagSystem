import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { database, ref, onValue, set, get, child as dbChild } from '../config/firebase';
import { auth } from '../config/firebase';
import { useFocusEffect } from '@react-navigation/native';

interface ScannedItem {
  tag: string;
  name: string;
  timestamp: string;
}

interface Child {
  id: string;
  name: string;
  class: string;
  parent_id: string;
  rfid_card?: string;
}

const DAYS = [
  { id: 'monday', label: 'Monday', value: 'monday' },
  { id: 'tuesday', label: 'Tuesday', value: 'tuesday' },
  { id: 'wednesday', label: 'Wednesday', value: 'wednesday' },
  { id: 'thursday', label: 'Thursday', value: 'thursday' },
  { id: 'friday', label: 'Friday', value: 'friday' },
];

export default function MonitorScreen() {
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [missingItems, setMissingItems] = useState<string[]>([]);
  const [missingExtraItems, setMissingExtraItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<string>('waiting');
  const [requiredItems, setRequiredItems] = useState<string[]>([]);
  const [extraItems, setExtraItems] = useState<string[]>([]);
  const [currentChild, setCurrentChild] = useState<Child | null>(null);
  const [allChildren, setAllChildren] = useState<Child[]>([]);
  const [showChildSelector, setShowChildSelector] = useState<boolean>(false);
  const [isRegisteringNFC, setIsRegisteringNFC] = useState<boolean>(false);
  const [scanningForNFC, setScanningForNFC] = useState<boolean>(false);
  
  const [showDaySelector, setShowDaySelector] = useState<boolean>(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  
  // State for extra items confirmation
  const [extraItemsConfirmed, setExtraItemsConfirmed] = useState<boolean>(false);
  const [showExtraConfirmButton, setShowExtraConfirmButton] = useState<boolean>(false);
  const [showReadyMessage, setShowReadyMessage] = useState<boolean>(false);

  const getCurrentDay = (): string => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().getDay();
    return days[today];
  };

  // Handle extra items confirmation - NO SCAN NEEDED!
  const confirmExtraItems = () => {
    if (missingExtraItems.length > 0) {
      Alert.alert(
        '✅ Extra Items Confirmation',
        `You have confirmed that you packed these ${missingExtraItems.length} extra item(s):\n\n${missingExtraItems.join('\n')}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Confirm', 
            onPress: () => {
              // Mark extra items as confirmed (no scanning needed)
              setExtraItemsConfirmed(true);
              setShowExtraConfirmButton(false);
              
              // Send confirmation to ESP32 to blink LED
              sendLEDCommandToESP32('green', 3, 200);
              
              // Show success message
              setShowReadyMessage(true);
              
              // Check if all items (regular) are also scanned
              if (missingItems.length === 0) {
                setSessionStatus('complete');
              } else {
                setSessionStatus('incomplete');
              }
              
              // Auto-hide message after 5 seconds
              setTimeout(() => {
                setShowReadyMessage(false);
              }, 5000);
            }
          }
        ]
      );
    } else {
      Alert.alert('Info', 'No extra items to confirm');
    }
  };

  // Send LED command to ESP32
  const sendLEDCommandToESP32 = (color: string, times: number, speed: number) => {
    set(ref(database, 'led_command'), {
      color: color,
      times: times,
      speed: speed,
      timestamp: Date.now(),
      childId: currentChild?.id
    });
    console.log(`LED command sent: ${color} ${times} times`);
  };

  const resetChildSession = async (childId: string) => {
    try {
      await set(ref(database, `current_session/${childId}/scanned_items`), null);
      await set(ref(database, `current_session/${childId}/missing_items`), null);
      await set(ref(database, `current_session/${childId}/status`), 'waiting');
      await set(ref(database, `current_session/${childId}/scanned_count`), 0);
      await set(ref(database, `current_session/${childId}/required_count`), 0);
      
      setScannedItems([]);
      setMissingItems([]);
      setMissingExtraItems([]);
      setSessionStatus('waiting');
      setExtraItemsConfirmed(false);
      setShowExtraConfirmButton(false);
      setShowReadyMessage(false);
    } catch (error) {
      console.error('Error resetting child session:', error);
    }
  };

  const writeSelectedDayToFirebase = async (childId: string, day: string) => {
    try {
      await set(ref(database, `selected_day/${childId}`), day);
    } catch (error) {
      console.error('Error writing selected day:', error);
    }
  };

  const writeActiveChildToFirebase = async (childId: string) => {
    try {
      await set(ref(database, 'active_child'), childId);
    } catch (error) {
      console.error('Error writing active child:', error);
    }
  };

  const registerNFCForChild = async () => {
    if (!currentChild) return;
    
    Alert.alert(
      'Register NFC Card',
      `Place the NFC card on the reader to register it for ${currentChild.name}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Scanning',
          onPress: () => {
            setIsRegisteringNFC(true);
            setScanningForNFC(true);
            set(ref(database, `nfc_registration/${currentChild.id}`), 'waiting');
          },
        },
      ]
    );
  };

  const loadScheduleForChildAndDay = async (childId: string, day: string): Promise<{ periods: string[], extras: string[] }> => {
    try {
      console.log(`📅 Loading timetable for ${childId} on ${day}`);
      
      const snapshot = await get(dbChild(ref(database), `timetable/${childId}/${day}`));
      
      const periods: string[] = [];
      const extras: string[] = [];
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log(`✅ Found timetable for ${childId} on ${day}`);
        
        const periodValues = [
          data.period1,
          data.period2,
          data.period3,
          data.period4,
          data.period5,
        ].filter(Boolean);
        periods.push(...periodValues);
        
        if (data.essentials && Array.isArray(data.essentials)) {
          periods.push(...data.essentials);
        }
        
        if (data.extraItems && Array.isArray(data.extraItems)) {
          extras.push(...data.extraItems);
        }
        
        console.log(`📚 Regular items (${periods.length}):`, periods);
        console.log(`➕ Extra items (${extras.length}):`, extras);
      } else {
        console.log(`❌ No timetable found for ${childId} on ${day}`);
      }
      
      return { periods, extras };
    } catch (error) {
      console.error('Error loading schedule:', error);
      return { periods: [], extras: [] };
    }
  };

  const loadChildren = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }
      
      const studentsSnapshot = await get(dbChild(ref(database), `students/${user.uid}`));
      const childrenList: Child[] = [];
      
      if (studentsSnapshot.exists()) {
        const students = studentsSnapshot.val();
        for (const key in students) {
          childrenList.push({
            id: key,
            name: students[key].name || "Unknown",
            class: students[key].class || "",
            parent_id: user.uid,
            rfid_card: students[key].rfid_card || null,
          });
        }
      }
      
      setAllChildren(childrenList);
      
      const activeChildSnapshot = await get(dbChild(ref(database), 'active_child'));
      let activeChildId = '';
      if (activeChildSnapshot.exists()) {
        activeChildId = activeChildSnapshot.val();
      }
      
      let savedDay = '';
      if (activeChildId) {
        const savedDaySnapshot = await get(dbChild(ref(database), `selected_day/${activeChildId}`));
        if (savedDaySnapshot.exists()) {
          savedDay = savedDaySnapshot.val();
        }
      }
      
      if (activeChildId && childrenList.find(c => c.id === activeChildId)) {
        const selected = childrenList.find(c => c.id === activeChildId) || null;
        setCurrentChild(selected);
        if (selected) {
          const dayToLoad = savedDay || getCurrentDay();
          setSelectedDay(dayToLoad);
          await resetChildSession(selected.id);
          await loadTimetableForChild(selected.id, dayToLoad);
        }
      } else if (childrenList.length > 0) {
        const firstChild = childrenList[0];
        setCurrentChild(firstChild);
        await writeActiveChildToFirebase(firstChild.id);
        const dayToLoad = getCurrentDay();
        setSelectedDay(dayToLoad);
        await resetChildSession(firstChild.id);
        await loadTimetableForChild(firstChild.id, dayToLoad);
      } else {
        setCurrentChild(null);
        setRequiredItems([]);
        setExtraItems([]);
        setScannedItems([]);
        setMissingItems([]);
        setMissingExtraItems([]);
        setSessionStatus('waiting');
      }
      
    } catch (error) {
      console.error('Error loading children:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTimetableForChild = async (childId: string, day: string) => {
    console.log(`🔄 Loading timetable for ${childId} on ${day}`);
    const { periods, extras } = await loadScheduleForChildAndDay(childId, day);
    setRequiredItems(periods);
    setExtraItems(extras);
    setMissingItems([...periods]);
    setMissingExtraItems([...extras]);
    setScannedItems([]);
    setSessionStatus('waiting');
    setExtraItemsConfirmed(false);
    setShowExtraConfirmButton(extras.length > 0);
    setShowReadyMessage(false);
    await set(ref(database, `current_session/${childId}/required_count`), periods.length + extras.length);
  };

  const handleChildSelect = async (child: Child) => {
    if (currentChild?.id === child.id) {
      setShowChildSelector(false);
      return;
    }
    
    setCurrentChild(child);
    setShowChildSelector(false);
    await writeActiveChildToFirebase(child.id);
    await resetChildSession(child.id);
    
    const savedDaySnapshot = await get(dbChild(ref(database), `selected_day/${child.id}`));
    let dayToLoad = getCurrentDay();
    if (savedDaySnapshot.exists()) {
      dayToLoad = savedDaySnapshot.val();
    }
    setSelectedDay(dayToLoad);
    await loadTimetableForChild(child.id, dayToLoad);
    
    Alert.alert('Child Switched', `Now monitoring ${child.name} on ${dayToLoad}`);
  };

  const handleDaySelect = async (day: string) => {
    if (!currentChild) return;
    
    setSelectedDay(day);
    setShowDaySelector(false);
    await writeSelectedDayToFirebase(currentChild.id, day);
    await resetChildSession(currentChild.id);
    await loadTimetableForChild(currentChild.id, day);
    
    Alert.alert('Day Changed', `Now showing schedule for ${day.toUpperCase()}`);
  };

  const loadRealTimeMode = async () => {
    if (!currentChild) return;
    
    const currentDay = getCurrentDay();
    setSelectedDay(currentDay);
    await writeSelectedDayToFirebase(currentChild.id, currentDay);
    await resetChildSession(currentChild.id);
    await loadTimetableForChild(currentChild.id, currentDay);
    
    Alert.alert('Real-Time Mode', `Now showing today's schedule (${currentDay})`);
  };

  const resetSession = async () => {
    if (!currentChild) return;
    
    Alert.alert(
      'Reset Session',
      `Are you sure you want to reset all scanned items for ${currentChild.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetChildSession(currentChild.id);
            await loadTimetableForChild(currentChild.id, selectedDay || getCurrentDay());
            Alert.alert('Success', 'Session reset successfully!');
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      loadChildren();
    }, [])
  );

  useEffect(() => {
    if (!currentChild) return;
    
    const nfcRegRef = ref(database, `nfc_registration/${currentChild.id}`);
    const unsubscribe = onValue(nfcRegRef, (snapshot) => {
      const status = snapshot.val();
      if (status === 'completed' && isRegisteringNFC) {
        setIsRegisteringNFC(false);
        setScanningForNFC(false);
        Alert.alert('Success', `NFC card registered for ${currentChild.name}!`);
        loadChildren();
      } else if (status === 'failed' && isRegisteringNFC) {
        setIsRegisteringNFC(false);
        setScanningForNFC(false);
        Alert.alert('Error', 'Failed to register NFC card. Please try again.');
      }
    });
    
    return () => unsubscribe();
  }, [currentChild, isRegisteringNFC]);

  useEffect(() => {
    if (!currentChild) return;
    
    const scannedRef = ref(database, `current_session/${currentChild.id}/scanned_items`);
    const unsubscribeScanned = onValue(scannedRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const items: ScannedItem[] = [];
        Object.keys(data).forEach((key) => {
          items.push(data[key]);
        });
        items.sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));
        setScannedItems(items);
        
        const scannedNames = items.map(item => item.name);
        
        const missingReg = requiredItems.filter(item => !scannedNames.includes(item));
        const missingExtra = extraItems.filter(item => !scannedNames.includes(item));
        
        setMissingItems(missingReg);
        setMissingExtraItems(missingExtra);
        
        // Show confirm button only if extra items are missing and not yet confirmed
        setShowExtraConfirmButton(missingExtra.length > 0 && !extraItemsConfirmed);
        
        const allRequired = [...requiredItems, ...extraItems];
        if (missingReg.length === 0 && (missingExtra.length === 0 || extraItemsConfirmed)) {
          setSessionStatus('complete');
          setShowReadyMessage(true);
          setTimeout(() => setShowReadyMessage(false), 5000);
        } else if (items.length > 0) {
          setSessionStatus('incomplete');
        } else {
          setSessionStatus('waiting');
        }
      } else {
        setMissingItems([...requiredItems]);
        setMissingExtraItems([...extraItems]);
        setSessionStatus('waiting');
        setShowExtraConfirmButton(extraItems.length > 0 && !extraItemsConfirmed);
      }
    });

    const statusRef = ref(database, `current_session/${currentChild.id}/status`);
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      if (status) {
        setSessionStatus(status);
      }
    });

    return () => {
      unsubscribeScanned();
      unsubscribeStatus();
    };
  }, [currentChild, requiredItems, extraItems, extraItemsConfirmed]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (currentChild) {
      await loadTimetableForChild(currentChild.id, selectedDay || getCurrentDay());
    } else {
      await loadChildren();
    }
    setRefreshing(false);
  };

  const getDisplayDay = () => {
    if (selectedDay) {
      const dayObj = DAYS.find(d => d.value === selectedDay);
      return dayObj ? dayObj.label : selectedDay.toUpperCase();
    }
    return 'Select Day';
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4a6fa5" />
        <Text style={styles.loadingText}>Loading children...</Text>
      </View>
    );
  }

  const totalRequired = requiredItems.length + extraItems.length;
  const totalScanned = scannedItems.length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Child Info Header */}
      <TouchableOpacity 
        style={styles.childHeader} 
        onPress={() => allChildren.length > 0 && setShowChildSelector(true)}
        disabled={allChildren.length === 0}
      >
        <Text style={styles.childName}>
          👶 {currentChild?.name || (allChildren.length === 0 ? 'No Child Registered' : 'Select Child')}
        </Text>
        <Text style={styles.childId}>ID: {currentChild?.id || 'N/A'}</Text>
        <Text style={styles.childDate}>{new Date().toLocaleDateString()}</Text>
        {allChildren.length > 1 && (
          <Text style={styles.switchText}>▼ Tap to switch child ▼</Text>
        )}
        {allChildren.length === 0 && (
          <Text style={styles.registerHint}>Register a child first in the app</Text>
        )}
      </TouchableOpacity>

      {/* Ready to Go to School Banner */}
      {showReadyMessage && (
        <View style={styles.readyBanner}>
          <Text style={styles.readyIcon}>🎒</Text>
          <Text style={styles.readyText}>Ready to Go to School!</Text>
          <Text style={styles.readySubtext}>All items packed successfully</Text>
        </View>
      )}

      {/* NFC Registration Button */}
      {currentChild && !currentChild.rfid_card && (
        <TouchableOpacity style={styles.nfcButton} onPress={registerNFCForChild}>
          <Text style={styles.nfcButtonText}>
            {scanningForNFC ? '⏳ Scanning for NFC...' : '🏷️ Register NFC Card'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Child Selector Modal */}
      <Modal
        visible={showChildSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChildSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Child</Text>
            <FlatList
              data={allChildren}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.childOption,
                    currentChild?.id === item.id && styles.childOptionActive
                  ]}
                  onPress={() => handleChildSelect(item)}
                >
                  <View>
                    <Text style={styles.childOptionText}>{item.name}</Text>
                    <Text style={styles.childOptionClass}>{item.class}</Text>
                  </View>
                  {item.rfid_card ? (
                    <Text style={styles.rfidStatus}>✅ RFID Registered</Text>
                  ) : (
                    <Text style={styles.rfidStatusMissing}>⚠️ No RFID</Text>
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowChildSelector(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Day Selector Row */}
      <View style={styles.daySelectorRow}>
        <TouchableOpacity 
          style={[styles.daySelectorButton, !currentChild && styles.disabledButton]}
          onPress={() => currentChild && setShowDaySelector(true)}
          disabled={!currentChild}
        >
          <Text style={styles.daySelectorButtonText}>
            📅 {getDisplayDay()}
          </Text>
        </TouchableOpacity>
        
        {selectedDay && selectedDay !== getCurrentDay() && currentChild && (
          <TouchableOpacity style={styles.realTimeButton} onPress={loadRealTimeMode}>
            <Text style={styles.realTimeButtonText}>🔄 Today</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.resetButton, !currentChild && styles.disabledButton]}
          onPress={resetSession}
          disabled={!currentChild}
        >
          <Text style={styles.resetButtonText}>🗑️ Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Day Selector Modal */}
      <Modal
        visible={showDaySelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDaySelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Day (Monday - Friday)</Text>
            <FlatList
              data={DAYS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dayOption}
                  onPress={() => handleDaySelect(item.value)}
                >
                  <Text style={styles.dayOptionText}>{item.label}</Text>
                  <Text style={styles.dayOptionArrow}>→</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDaySelector(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Display Current Day */}
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          📅 Showing schedule for: {getDisplayDay()}
        </Text>
        <Text style={styles.infoText}>
          📋 Total items needed: {totalRequired}
        </Text>
        {extraItems.length > 0 && (
          <Text style={styles.extraBadge}>➕ {extraItems.length} extra item(s) added</Text>
        )}
      </View>

      {/* Status Header */}
      <View style={styles.statusHeader}>
        <Text style={styles.statusTitle}>📦 Session Status</Text>
        <Text style={[
          styles.statusValue,
          sessionStatus === 'complete' && styles.statusComplete,
          sessionStatus === 'incomplete' && styles.statusIncomplete,
        ]}>
          {!currentChild ? '👶 No child selected' :
           sessionStatus === 'complete' ? '✅ Ready for School!' :
           sessionStatus === 'incomplete' ? '⚠️ Missing Items!' :
           '🔄 Waiting for scans...'}
        </Text>
        <Text style={styles.progressText}>
          📦 Scanned: {totalScanned} / {requiredItems.length} (Regular)
          {extraItems.length > 0 && ` | Extra: ${extraItemsConfirmed ? '✅ Confirmed' : '⏳ Pending'}`}
        </Text>
      </View>

      {/* 📚 REGULAR ITEMS SECTION */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📚 Today's Schedule</Text>
        
        {requiredItems.length > 0 ? (
          requiredItems.map((item, index) => (
            <View key={index} style={styles.scheduleItem}>
              <Text style={styles.checkmark}>
                {scannedItems.some(s => s.name === item) ? '✅' : '📌'}
              </Text>
              <Text style={[
                styles.itemName,
                scannedItems.some(s => s.name === item) && styles.scannedText
              ]}>
                {item}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noData}>
            ⚠️ No timetable set for {currentChild?.name || 'this child'} on {getDisplayDay()}.{'\n'}
            Please add timetable in the Timetable screen.
          </Text>
        )}
      </View>

      {/* ➕ EXTRA ITEMS SECTION */}
      {extraItems.length > 0 && (
        <View style={[styles.card, styles.extraCard]}>
          <Text style={[styles.cardTitle, styles.extraTitle]}>➕ Extra Items to Bring</Text>
          <Text style={styles.extraHint}>Parent added these items for today</Text>
          
          {extraItems.map((item, index) => (
            <View key={index} style={[styles.scheduleItem, styles.extraItemRow]}>
              <Text style={styles.extraCheckmark}>
                {extraItemsConfirmed ? '✅' : '➕'}
              </Text>
              <Text style={[
                styles.itemName,
                styles.extraItemText,
                extraItemsConfirmed && styles.scannedText
              ]}>
                {item}
              </Text>
              {!extraItemsConfirmed && (
                <View style={styles.highlightBadge}>
                  <Text style={styles.highlightText}>⚠️ Required!</Text>
                </View>
              )}
            </View>
          ))}
          
          {/* OK BUTTON FOR EXTRA ITEMS - NO SCAN NEEDED! */}
          {showExtraConfirmButton && (
            <TouchableOpacity style={styles.okButton} onPress={confirmExtraItems}>
              <Text style={styles.okButtonText}>✅ OK, I've Packed These Extra Items</Text>
            </TouchableOpacity>
          )}
          
          {extraItemsConfirmed && (
            <View style={styles.confirmedBadge}>
              <Text style={styles.confirmedText}>✅ Extra items confirmed by parent</Text>
            </View>
          )}
        </View>
      )}

      {/* Scanned Items List */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          ✅ Scanned Items ({scannedItems.length})
        </Text>
        {scannedItems.length > 0 ? (
          scannedItems.map((item, index) => (
            <View key={index} style={styles.scannedItem}>
              <Text style={styles.checkmark}>✅</Text>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemTime}>
                {new Date(parseInt(item.timestamp)).toLocaleTimeString()}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noData}>No items scanned yet</Text>
        )}
      </View>

      {/* Missing Regular Items */}
      {missingItems.length > 0 && (
        <View style={[styles.card, styles.missingCard]}>
          <Text style={styles.cardTitle}>
            ❌ Missing Items ({missingItems.length})
          </Text>
          {missingItems.map((item, index) => (
            <View key={index} style={styles.missingItem}>
              <Text style={styles.crossMark}>❌</Text>
              <Text style={styles.missingItemName}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Instruction */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📖 How It Works</Text>
        <Text style={styles.instructionText}>
          1. Register a child first{'\n'}
          2. Register NFC tags for books and essentials{'\n'}
          3. Add extra items in Timetable screen{'\n'}
          4. Select your child from the top header{'\n'}
          5. Select a day (Monday-Friday) to see schedule{'\n'}
          6. Child scans regular items on the bag{'\n'}
          7. ✅ Regular items appear above{'\n'}
          8. ➕ Extra items are highlighted in orange{'\n'}
          9. Click "OK" to confirm extra items (no scanning needed!){'\n'}
          10. 🎉 When all regular items scanned + extra items confirmed → "Ready for School!"
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5' 
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#f5f5f5' 
  },
  loadingText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#666' 
  },
  childHeader: { 
    backgroundColor: '#2c3e50', 
    padding: 15, 
    alignItems: 'center' 
  },
  childName: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: 'white' 
  },
  childId: { 
    fontSize: 12, 
    color: 'rgba(255,255,255,0.7)', 
    marginTop: 4 
  },
  childDate: { 
    fontSize: 12, 
    color: 'rgba(255,255,255,0.5)', 
    marginTop: 2 
  },
  switchText: { 
    fontSize: 10, 
    color: 'rgba(255,255,255,0.5)', 
    marginTop: 8 
  },
  registerHint: { 
    fontSize: 10, 
    color: '#ff9800', 
    marginTop: 8 
  },
  readyBanner: {
    backgroundColor: '#4caf50',
    margin: 15,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 3,
  },
  readyIcon: {
    fontSize: 40,
    marginBottom: 5,
  },
  readyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  readySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 5,
  },
  nfcButton: { 
    backgroundColor: '#4caf50', 
    margin: 10, 
    padding: 12, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  nfcButtonText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  daySelectorRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    padding: 10, 
    backgroundColor: '#e0e0e0' 
  },
  daySelectorButton: { 
    backgroundColor: '#4a6fa5', 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    borderRadius: 20,
    flex: 1,
    marginRight: 8,
    alignItems: 'center'
  },
  daySelectorButtonText: { 
    color: 'white', 
    fontWeight: 'bold' 
  },
  realTimeButton: { 
    backgroundColor: '#4caf50', 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    borderRadius: 20,
    marginRight: 8
  },
  realTimeButtonText: { 
    color: 'white', 
    fontWeight: 'bold' 
  },
  resetButton: { 
    backgroundColor: '#ff9800', 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    borderRadius: 20 
  },
  resetButtonText: { 
    color: 'white', 
    fontWeight: 'bold' 
  },
  disabledButton: { 
    backgroundColor: '#aaa', 
    opacity: 0.5 
  },
  infoCard: { 
    backgroundColor: '#f0f0f0', 
    margin: 10, 
    padding: 10, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  infoText: { 
    fontSize: 14, 
    color: '#666' 
  },
  extraBadge: { 
    fontSize: 12, 
    color: '#ff9800', 
    marginTop: 5,
    fontWeight: 'bold'
  },
  statusHeader: { 
    backgroundColor: '#4a6fa5', 
    padding: 20, 
    alignItems: 'center' 
  },
  statusTitle: { 
    fontSize: 16, 
    color: 'rgba(255,255,255,0.8)', 
    marginBottom: 5 
  },
  statusValue: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: 'white' 
  },
  statusComplete: { 
    color: '#4caf50' 
  },
  statusIncomplete: { 
    color: '#ff9800' 
  },
  progressText: { 
    fontSize: 14, 
    color: 'rgba(255,255,255,0.9)', 
    marginTop: 8 
  },
  card: { 
    backgroundColor: 'white', 
    margin: 10, 
    padding: 15, 
    borderRadius: 12, 
    elevation: 3, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4 
  },
  extraCard: {
    backgroundColor: '#fff8e1',
    borderColor: '#ff9800',
    borderWidth: 1,
  },
  missingCard: { 
    backgroundColor: '#fff3f3', 
    borderColor: '#ff4444', 
    borderWidth: 1 
  },
  cardTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 15, 
    color: '#333' 
  },
  extraTitle: {
    color: '#e67e22',
  },
  extraHint: {
    fontSize: 12,
    color: '#e67e22',
    marginBottom: 10,
  },
  okButton: {
    backgroundColor: '#4caf50',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  okButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmedBadge: {
    backgroundColor: '#e8f5e9',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  confirmedText: {
    color: '#4caf50',
    fontWeight: 'bold',
    fontSize: 14,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  extraItemRow: {
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginVertical: 2,
  },
  extraItemText: {
    color: '#e67e22',
    fontWeight: '500',
  },
  extraCheckmark: {
    fontSize: 18,
    marginRight: 12,
    width: 30,
  },
  highlightBadge: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  highlightText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  scannedItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee' 
  },
  missingItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#ffcccc' 
  },
  checkmark: { 
    fontSize: 18, 
    marginRight: 12,
    width: 30
  },
  crossMark: { 
    fontSize: 18, 
    marginRight: 12,
    width: 30
  },
  itemName: { 
    flex: 1, 
    fontSize: 16, 
    color: '#333' 
  },
  scannedText: {
    color: '#4caf50',
    textDecorationLine: 'line-through'
  },
  missingItemName: { 
    flex: 1, 
    fontSize: 16, 
    color: '#ff4444' 
  },
  itemTime: { 
    fontSize: 12, 
    color: '#999' 
  },
  noData: { 
    textAlign: 'center', 
    color: '#999', 
    padding: 20, 
    fontSize: 14 
  },
  instructionText: { 
    fontSize: 14, 
    color: '#666', 
    lineHeight: 22 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContainer: { 
    backgroundColor: 'white', 
    borderRadius: 20, 
    padding: 20, 
    width: '80%', 
    maxHeight: '70%' 
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    marginBottom: 15, 
    color: '#333' 
  },
  childOption: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 15, 
    paddingHorizontal: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee' 
  },
  childOptionActive: { 
    backgroundColor: '#e8f5e9' 
  },
  childOptionText: { 
    fontSize: 16, 
    color: '#333' 
  },
  childOptionClass: { 
    fontSize: 12, 
    color: '#666' 
  },
  rfidStatus: { 
    fontSize: 12, 
    color: '#4caf50' 
  },
  rfidStatusMissing: { 
    fontSize: 12, 
    color: '#ff9800' 
  },
  dayOption: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 15, 
    paddingHorizontal: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee' 
  },
  dayOptionText: { 
    fontSize: 16, 
    color: '#333' 
  },
  dayOptionArrow: { 
    fontSize: 18, 
    color: '#4a6fa5' 
  },
  modalCloseButton: { 
    marginTop: 15, 
    padding: 12, 
    backgroundColor: '#f0f0f0', 
    borderRadius: 10, 
    alignItems: 'center' 
  },
  modalCloseButtonText: { 
    fontSize: 16, 
    color: '#666' 
  },
});
