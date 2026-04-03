import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { api, MEDICATIONS_PATH } from '../utils/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

const formatTime = (date) => {
  if (!date) return '00:00';
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const parseTimeString = (timeString) => {
  const now = new Date();
  if (typeof timeString === 'string' && timeString.includes(':')) {
    const [hours, minutes] = timeString.split(':');
    now.setHours(parseInt(hours, 10) || 0, parseInt(minutes, 10) || 0, 0, 0);
  } else {
    now.setHours(9, 0, 0, 0);
  }
  return now;
};

const MedicationUpdateScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const medicationId = params?.medicationId;

  const [medicineName, setMedicineName] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const [dosages, setDosages] = useState([]);
  const [stock, setStock] = useState(0);
  const [reminder, setReminder] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [slotNumber, setSlotNumber] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentDosageIndex, setCurrentDosageIndex] = useState(null);
  const [timePickerValue, setTimePickerValue] = useState(new Date());

  const fetchMedication = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) throw new Error("User not authenticated.");
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      const response = await api.get(`${MEDICATIONS_PATH}${medicationId}/`, config);

      setMedicineName(response.data.name || '');
      setSelectedDays(response.data.selected_days || []);
      setDosages((response.data.dosages || []).map((d, index) => ({
        ...d,
        id: d.id || `temp-${Date.now()}-${index}`,
        time: d.time || '09:00',
        amount: d.amount || 0,
      })));
      setStock(response.data.stock || 0);
      setReminder(response.data.reminder || 0);
      setSlotNumber(response.data.dispenser_slot || 1);
    } catch (err) {
      console.error('Error fetching medication:', err.response?.data || err.message);
      let errorMessage = "Could not load medication data.";
      if (err.response?.status === 401 || err.response?.status === 403) errorMessage = "Authentication failed.";
      else if (err.response?.status === 404) errorMessage = `Medication ID ${medicationId} not found.`;
      else if (err.message?.includes('Network Error')) errorMessage = "Network error. Check connection.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [medicationId]);

  useFocusEffect(
    useCallback(() => {
      if (medicationId) {
        fetchMedication();
      } else {
        setError("Medication ID is missing.");
        setIsLoading(false);
        Alert.alert("Error", "Cannot load medication details without an ID.", [
          { text: "OK", onPress: () => router.canGoBack() ? router.back() : router.replace('/(tab)') }
        ]);
      }
      return () => { };
    }, [medicationId, fetchMedication])
  );

  const onUpdate = async () => {
    if (!medicationId) { Alert.alert("Error", "Cannot update without a medication ID."); return; }
    setIsSaving(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const storedUserId = await AsyncStorage.getItem('userId');
      const userId = storedUserId ? parseInt(storedUserId, 10) : null;
      if (!token || !userId) throw new Error("User not authenticated.");

      const updatedData = {
        name: medicineName,
        selected_days: selectedDays,
        dosages: dosages.map(d => ({
          id: d.id?.toString().startsWith('temp-') ? undefined : d.id,
          amount: parseFloat(d.amount) || 0,
          time: d.time || '00:00',
        })),
        stock: parseInt(stock, 10) || 0,
        reminder: parseInt(reminder, 10) || 0,
        dispenser_slot: parseInt(slotNumber, 10) || 0,
      };

      if (!updatedData.name.trim()) throw new Error("Medicine name cannot be empty.");
      if (updatedData.selected_days.length === 0) throw new Error("Please select at least one day.");
      if (updatedData.dosages.length === 0) throw new Error("Please add at least one dosage time.");

      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      const response = await api.put(`${MEDICATIONS_PATH}${medicationId}/`, updatedData, config);

      if (response.status === 200) {
        Alert.alert('Success', 'Medication updated successfully!');
        router.canGoBack() ? router.back() : router.replace("/(tab)");
      } else {
        Alert.alert('Update Info', `Server responded with status: ${response.status}`);
      }
    } catch (err) {
      console.error('Error updating medication:', err.response?.data || err.message);
      let errorMessage = "Could not update medication.";
      if (err.response?.status === 401 || err.response?.status === 403) {
        errorMessage = "Authentication failed or permission denied.";
      } else if (err.response?.status === 404) {
        errorMessage = `Medication ID ${medicationId} not found.`;
      } else if (err.response?.status === 400) {
        const backendErrors = Object.entries(err.response.data)
          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
          .join('\n');
        errorMessage = `Please correct:\n${backendErrors || 'Invalid data.'}`;
      } else {
        errorMessage = err.message || "An unknown error occurred.";
      }
      Alert.alert("Update Failed", errorMessage);
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (day) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const adjustValue = (setter, currentValue, increment, min = 0, max = Infinity) => {
    setter(Math.min(max, Math.max(min, (parseInt(currentValue, 10) || 0) + increment)));
  };

  const updateDosageAmount = (index, change) => {
    const newDosages = [...dosages];
    if (!newDosages[index]) return;
    newDosages[index].amount = Math.max(1, (parseFloat(newDosages[index].amount) || 0) + change);
    setDosages(newDosages);
  };

  const addDosageRow = () => setDosages([...dosages, { id: `temp-${Date.now()}`, amount: 1, time: '09:00' }]);

  const removeDosageRow = (idToRemove) => {
    if (dosages.length <= 1) { Alert.alert("Cannot Remove", "You must have at least one dosage time."); return; }
    setDosages(dosages.filter(d => d.id !== idToRemove));
  };

  const openTimePicker = (index) => {
    if (isSaving) return;
    setCurrentDosageIndex(index);
    setTimePickerValue(parseTimeString(dosages[index]?.time || '09:00'));
    setShowTimePicker(true);
  };

  const onChangeTime = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (event.type === 'set' && selectedDate && currentDosageIndex !== null) {
      if (Platform.OS === 'ios') setShowTimePicker(false);
      const newDosages = [...dosages];
      if (newDosages[currentDosageIndex]) {
        newDosages[currentDosageIndex].time = formatTime(selectedDate);
        setDosages(newDosages);
      }
      setCurrentDosageIndex(null);
    } else if (event.type === 'dismissed') {
      if (Platform.OS === 'ios') setShowTimePicker(false);
      setCurrentDosageIndex(null);
    }
  };

  const ALL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color="#CC7755" />
        <Text style={styles.loadingText}>Loading Medication...</Text>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !medicineName) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]} edges={['top', 'bottom']}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.saveButton} onPress={() => router.back()}>
          <Text style={styles.saveButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    // edges={['top', 'bottom']} — stack screen, handles both status bar and Android nav bar
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Medicine Name */}
        <View style={styles.medicationName}>
          <TextInput
            placeholder="Medicine Name"
            placeholderTextColor="rgb(150,150,150)"
            style={styles.nameInput}
            value={medicineName}
            onChangeText={setMedicineName}
            editable={!isSaving}
          />
        </View>

        {/* Frequency */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Frequency</Text>

          {/* Quick select */}
          <View style={styles.quickSelectRow}>
            <TouchableOpacity style={styles.quickSelectButton} onPress={() => setSelectedDays([...ALL_DAYS])}>
              <Text style={styles.quickSelectText}>Every Day</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickSelectButton} onPress={() => setSelectedDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])}>
              <Text style={styles.quickSelectText}>Weekdays</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickSelectButton, { backgroundColor: '#eee' }]} onPress={() => setSelectedDays([])}>
              <Text style={[styles.quickSelectText, { color: '#666' }]}>Clear</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.daysContainer}>
            <View style={styles.daysRow}>
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday'].map(day => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayButton, selectedDays.includes(day) && styles.selectedDay]}
                  onPress={() => toggleDay(day)} disabled={isSaving}
                >
                  <Text style={[styles.dayText, selectedDays.includes(day) && styles.selectedDayText]}>{day}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.daysRow}>
              {['Thursday', 'Friday', 'Saturday'].map(day => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayButton, selectedDays.includes(day) && styles.selectedDay]}
                  onPress={() => toggleDay(day)} disabled={isSaving}
                >
                  <Text style={[styles.dayText, selectedDays.includes(day) && styles.selectedDayText]}>{day}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Schedule */}
        <View style={styles.sectionContainer}>
          <View style={styles.scheduleTitleContainer}>
            <Text style={styles.sectionTitle}>Schedule</Text>
            <TouchableOpacity onPress={addDosageRow} style={styles.addDosageButton} disabled={isSaving}>
              <Feather name="plus-circle" size={22} color="#CC7755" />
            </TouchableOpacity>
          </View>
          <View style={styles.scheduleHeader}>
            <Text style={styles.scheduleHeaderText}>Dosage</Text>
            <Text style={styles.scheduleHeaderText}>Time</Text>
            <View style={{ width: 30 }} />
          </View>

          {(dosages || []).map((dosage, index) => (
            <View key={dosage.id} style={styles.dosageRow}>
              <View style={styles.dosageControl}>
                <Text style={styles.dosageValue}>{dosage.amount}</Text>
                <View style={styles.dosageButtons}>
                  <TouchableOpacity onPress={() => updateDosageAmount(index, 1)} disabled={isSaving}>
                    <Feather name="chevron-up" size={18} color="#333" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => updateDosageAmount(index, -1)} disabled={isSaving}>
                    <Feather name="chevron-down" size={18} color="#333" />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity style={styles.timeButton} onPress={() => openTimePicker(index)} disabled={isSaving}>
                <Text style={styles.timeText}>{dosage.time || 'Set Time'}</Text>
                <Feather name="clock" size={16} color="white" style={{ marginLeft: 5 }} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeDosageRow(dosage.id)} style={styles.removeDosageButton} disabled={isSaving}>
                <Feather name="minus-circle" size={20} color="#d9534f" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {showTimePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={timePickerValue}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onChangeTime}
          />
        )}

        {/* Stock & Reminder */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Stock & Reminder</Text>
          <View style={styles.stockReminderRow}>
            <View style={styles.inlineControlContainer}>
              <Text style={styles.inlineControlLabel}>Current Stock</Text>
              <View style={styles.stockControl}>
                <Text style={styles.stockValue}>{stock}</Text>
                <View style={styles.stockButtons}>
                  <TouchableOpacity onPress={() => adjustValue(setStock, stock, 1)} disabled={isSaving}>
                    <Feather name="chevron-up" size={18} color="#333" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => adjustValue(setStock, stock, -1)} disabled={isSaving}>
                    <Feather name="chevron-down" size={18} color="#333" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={styles.inlineControlContainer}>
              <Text style={styles.inlineControlLabel}>Remind (stock before)</Text>
              <View style={styles.reminderControl}>
                <Text style={styles.reminderValue}>{reminder}</Text>
                <View style={styles.reminderButtons}>
                  <TouchableOpacity onPress={() => adjustValue(setReminder, reminder, 1)} disabled={isSaving}>
                    <Feather name="chevron-up" size={18} color="#333" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => adjustValue(setReminder, reminder, -1)} disabled={isSaving}>
                    <Feather name="chevron-down" size={18} color="#333" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Slot */}
        <View style={styles.sectionContainer}>
          <View style={styles.slotContainer}>
            <Text style={styles.inlineControlLabel}>Select Slot Number (1-4)</Text>
            <View style={styles.slotControl}>
              <Text style={styles.slotValue}>{slotNumber}</Text>
              <View style={styles.slotButtons}>
                <TouchableOpacity onPress={() => adjustValue(setSlotNumber, slotNumber, 1, 1, 4)} disabled={slotNumber >= 4}>
                  <Feather name="chevron-up" size={18} color={slotNumber >= 4 ? "#ccc" : "#333"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => adjustValue(setSlotNumber, slotNumber, -1, 1, 4)} disabled={slotNumber <= 1}>
                  <Feather name="chevron-down" size={18} color={slotNumber <= 1 ? "#ccc" : "#333"} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Update Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={onUpdate}
          disabled={isSaving || isLoading}
        >
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Update Medication'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1, padding: 16 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { textAlign: 'center', marginTop: 10, fontSize: 18, color: 'grey' },
  errorText: { color: 'red', textAlign: 'center', marginVertical: 10, paddingHorizontal: 10, fontWeight: '500' },
  medicationName: { marginVertical: 16, paddingHorizontal: 10 },
  nameInput: {
    textAlign: "center", fontWeight: "bold", fontSize: 18, color: '#333',
    backgroundColor: 'white', borderRadius: 8, paddingVertical: 12,
    paddingHorizontal: 15, borderWidth: 1, borderColor: '#ddd',
  },
  sectionContainer: {
    backgroundColor: '#ffffff', borderRadius: 10, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 3,
  },
  sectionTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 16, color: '#444' },
  quickSelectRow: { flexDirection: "row", justifyContent: "center", marginBottom: 12, gap: 8 },
  quickSelectButton: { backgroundColor: "#CC7755", paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20 },
  quickSelectText: { color: "white", fontSize: 13, fontWeight: "500" },
  scheduleTitleContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  addDosageButton: { position: 'absolute', right: 0, padding: 5 },
  daysContainer: { alignItems: 'stretch' },
  daysRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8, flexWrap: 'wrap' },
  dayButton: {
    backgroundColor: '#CC7755', paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 15, margin: 4, minWidth: 50, alignItems: 'center',
  },
  selectedDay: { backgroundColor: '#a1887f' },
  dayText: { color: 'white', fontSize: 13, fontWeight: '500' },
  selectedDayText: { fontWeight: 'bold' },
  scheduleHeader: {
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5,
    marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5,
  },
  scheduleHeaderText: { fontSize: 14, fontWeight: '500', color: '#666', flex: 1, textAlign: 'center' },
  dosageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 5 },
  dosageControl: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0',
    borderRadius: 8, padding: 8, flex: 2, marginRight: 8,
  },
  dosageValue: { flex: 1, textAlign: 'center', color: '#333', fontWeight: 'bold', fontSize: 16 },
  dosageButtons: { alignItems: 'center' },
  timeButton: {
    backgroundColor: '#CC7755', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 10,
    flex: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  timeText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  removeDosageButton: { padding: 5, width: 30, alignItems: 'center' },
  stockReminderRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' },
  inlineControlContainer: { alignItems: 'center', width: '45%' },
  inlineControlLabel: { fontSize: 13, color: '#666', marginBottom: 5, textAlign: 'center' },
  stockControl: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0',
    borderRadius: 8, padding: 8, width: '100%',
  },
  stockValue: { flex: 1, textAlign: 'center', color: '#333', fontWeight: 'bold', fontSize: 16 },
  stockButtons: { alignItems: 'center' },
  reminderControl: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0',
    borderRadius: 8, padding: 8, width: '100%',
  },
  reminderValue: { flex: 1, textAlign: 'center', color: '#333', fontWeight: 'bold', fontSize: 16 },
  reminderButtons: { alignItems: 'center' },
  slotContainer: { alignItems: "center" },
  slotControl: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#f0f0f0",
    borderRadius: 8, padding: 8, width: "50%",
  },
  slotValue: { flex: 1, textAlign: "center", color: "#333", fontWeight: "bold", fontSize: 16 },
  slotButtons: { alignItems: "center", marginLeft: 8 },
  saveButton: {
    backgroundColor: '#CC7755', borderRadius: 25, paddingVertical: 15,
    alignItems: 'center', marginTop: 10, marginBottom: 20,
  },
  saveButtonDisabled: { backgroundColor: '#cccccc' },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: 'white' },
});

export default MedicationUpdateScreen;