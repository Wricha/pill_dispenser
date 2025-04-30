import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Platform, ActivityIndicator } from 'react-native'; // Import Alert, Platform, ActivityIndicator
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router"; // Import useFocusEffect, useLocalSearchParams
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
import DateTimePicker from '@react-native-community/datetimepicker'; // <-- Import DateTimePicker

// --- Configuration ---
// *** Use your correct, consistent backend IP/URL ***
const API_BASE_URL = "http://192.168.1.67:8000"; // Make sure this IP is correct and consistent
const MEDICATIONS_ENDPOINT_BASE = `${API_BASE_URL}/api/medications/`; // Base for individual meds
// --- ---

// Helper to format time (HH:MM)
const formatTime = (date) => {
    if (!date) return '00:00'; // Default or handle error
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

// Helper to parse time string ('HH:MM') into a Date object for the picker
const parseTimeString = (timeString) => {
    const now = new Date(); // Use today's date as base
    if (typeof timeString === 'string' && timeString.includes(':')) {
        const [hours, minutes] = timeString.split(':');
        // Use || 0 for safety in case split results in undefined/NaN
        now.setHours(parseInt(hours, 10) || 0, parseInt(minutes, 10) || 0, 0, 0);
    } else {
        // Default time if parsing fails, e.g., 9 AM
        now.setHours(9, 0, 0, 0);
    }
    return now;
};

const MedicationUpdateScreen = () => {
  const router = useRouter();
  // Use useLocalSearchParams with Expo Router v2/v3 to get parameters
  const params = useLocalSearchParams();
  const medicationId = params?.medicationId; // Get ID from params

  // --- State Variables ---
  const [medicineName, setMedicineName] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const [dosages, setDosages] = useState([]); // Expecting [{ id, amount, time: 'HH:MM' }, ...]
  const [stock, setStock] = useState(0); // Initialize with 0 or another suitable default
  const [reminder, setReminder] = useState(0); // Initialize with 0 or another suitable default
  const [isLoading, setIsLoading] = useState(true); // Start loading true for initial fetch
  const [slotNumber, setSlotNumber] = useState(1) // Default slot
  const [isSaving, setIsSaving] = useState(false); // Separate state for saving action
  const [error, setError] = useState(null);
  const [originalUserId, setOriginalUserId] = useState(null); // If needed for display/logic

  // --- State for Time Picker ---
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentDosageIndex, setCurrentDosageIndex] = useState(null); // Index of dosage being edited
  const [timePickerValue, setTimePickerValue] = useState(new Date()); // Date object for picker
  // --- ---

  // --- Fetch Initial Data ---
  const fetchMedication = useCallback(async () => {
    // No need to check medicationId here, useFocusEffect handles it
    console.log(`Workspaceing medication with ID: ${medicationId}`);
    setIsLoading(true); // Set loading true for fetch
    setError(null);
    let token = null;

    try {
        token = await AsyncStorage.getItem('accessToken');
        if (!token) {
            throw new Error("User not authenticated.");
        }

        const config = { headers: { 'Authorization': `Bearer ${token}` } };
        const response = await axios.get(`${API_BASE_URL}/api/medications/${medicationId}`, config);

        // Populate state with fetched data
        setMedicineName(response.data.name || '');
        setSelectedDays(response.data.selected_days || []);
        setDosages((response.data.dosages || []).map((d, index) => ({
             ...d,
             id: d.id || `temp-${Date.now()}-${index}`, // Ensure unique key for mapping
             time: d.time || '09:00', // Ensure time has a default string value
             amount: d.amount || 0 // Ensure amount has a default
         })));
        setStock(response.data.stock || 0); // Use default if null/undefined
        setReminder(response.data.reminder || 0); // Use default if null/undefined
        setOriginalUserId(response.data.user); // Store original owner ID if needed
        setStock(response.data.stock || 0);
        setSlotNumber(response.data.dispenser_slot || 0);


    } catch (err) {
        console.error('Error fetching medication:', err.response?.data || err.message);
        let errorMessage = "Could not load medication data.";
        if (err.response) {
             if (err.response.status === 401 || err.response.status === 403) {
                 errorMessage = "Authentication failed or you don't have permission.";
                 // Consider redirecting
                 // router.replace('/login');
             } else if (err.response.status === 404) {
                  errorMessage = `Medication with ID ${medicationId} not found.`;
             } else {
                  errorMessage = `Server error (Status: ${err.response.status})`;
             }
        } else if (err.message === "User not authenticated.") {
             errorMessage = err.message;
             // Consider redirecting
        } else if (err.message?.includes('Network Error')) {
             errorMessage = "Network error. Please check connection.";
        }
        setError(errorMessage);
        // Clear potentially partially loaded data on critical fetch errors
        setMedicineName('');
        setSelectedDays([]);
        setDosages([]);
        setStock(0);
        setReminder(0);
        setSlotNumber(0);
    } finally {
        setIsLoading(false); // Fetch complete
    }
  }, [medicationId]); // Dependency array for useCallback


  // Use useFocusEffect to fetch data when screen gains focus or medicationId changes
  useFocusEffect(
    useCallback(() => {
      console.log("Update Screen focused/ID changed, medicationId:", medicationId);
      if (medicationId) {
        fetchMedication();
      } else {
        // Handle case where ID is missing definitively
        setError("Medication ID is missing. Cannot load details.");
        setIsLoading(false); // Ensure loading stops
        Alert.alert("Error", "Cannot load medication details without an ID.", [
            { text: "OK", onPress: () => router.canGoBack() ? router.back() : router.replace('/(tab)') } // Navigate back on OK
        ]);
      }
      // Cleanup function (optional)
      return () => {
          console.log("Update Screen blurred/unmounted");
          // You could potentially reset state here if needed when leaving the screen
      };
    }, [medicationId, fetchMedication]) // Dependencies
  );

  // --- Update Data ---
  const onUpdate = async () => { // Renamed from updateMedication for clarity
    if (!medicationId) {
        Alert.alert("Error", "Cannot update without a medication ID.");
        return;
    }
    setIsSaving(true); // Use separate saving indicator
    setError(null);
    let token = null;

    try {
        token = await AsyncStorage.getItem('accessToken');
        const storedUserId = await AsyncStorage.getItem('userId'); // Also get userId to check ownership locally if desired
        const userId = storedUserId ? parseInt(storedUserId, 10) : null;

        if (!token || !userId) { throw new Error("User not authenticated."); }
        // Optional: Check if current user ID matches the original owner ID before sending update
        // if (originalUserId && userId !== originalUserId) {
        //     throw new Error("Permission denied: You cannot update medication belonging to another user.");
        // }

        const updatedData = {
            name: medicineName,
            selected_days: selectedDays,
            // Ensure dosages have valid numbers and required fields for backend
            dosages: dosages.map(d => ({
                amount: parseFloat(d.amount) || 0, // Ensure float/number
                time: d.time || '00:00' // Ensure time string
            })),
            stock: parseInt(stock, 10) || 0, // Ensure integer
            reminder: parseInt(reminder, 10) || 0, // Ensure integer
            dispenser_slot: parseInt(slotNumber, 10) || 0,
            // DO NOT SEND 'user' field on update. Backend uses request.user.
        };

        // --- Frontend Validation ---
        if (!updatedData.name.trim()) throw new Error("Medicine name cannot be empty.");
        if (updatedData.selected_days.length === 0) throw new Error("Please select at least one day.");
        if (updatedData.dosages.length === 0) throw new Error("Please add at least one dosage time.");
        let invalidTimeFound = false;
        updatedData.dosages.forEach(d => {
            if (!/^\d{2}:\d{2}$/.test(d.time)) {
                invalidTimeFound = true;
            }
            if (d.amount <= 0) {
                 throw new Error(`Dosage amount must be greater than 0 for time ${d.time}.`);
            }
        });
        if (invalidTimeFound) throw new Error(`One or more dosage times have an invalid format. Please use HH:MM.`);
        // --- End Validation ---


        const config = { headers: { 'Authorization': `Bearer ${token}` } };

        console.log(`Updating medication ID ${medicationId} with data:`, updatedData);
        // *** USE PUT Request for Update ***
        const response = await axios.put(`${API_BASE_URL}/api/medications/${medicationId}/`, updatedData, config);

        if (response.status === 200) { // HTTP 200 OK typically for update
            Alert.alert('Success', 'Medication updated successfully!');
             if (router.canGoBack()) {
                 router.back();
            } else {
                 router.replace("/(tab)"); // Fallback
            }
        } else {
             Alert.alert('Update Info', `Server responded with status: ${response.status}`);
        }

    } catch (err) {
        console.error('Error updating medication:', err.response?.data || err.message);
        let errorMessage = "Could not update medication.";
        if (err.response) {
             if (err.response.status === 401 || err.response.status === 403) {
                 errorMessage = "Authentication failed or permission denied.";
                 // router.replace('/login');
             } else if (err.response.status === 404) {
                 errorMessage = `Update failed: Medication with ID ${medicationId} not found.`;
             } else if (err.response.status === 400) { // Validation errors from backend
                 const backendErrors = Object.entries(err.response.data).map(([field, messages]) =>
                     `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`
                 ).join('\n');
                 errorMessage = `Please correct the following:\n${backendErrors || 'Invalid data.'}`;
             } else {
                  errorMessage = `Update failed (Server Status: ${err.response.status})`;
             }
             Alert.alert("Update Failed", errorMessage);
        } else if (err.message === "User not authenticated.") {
             errorMessage = err.message;
             Alert.alert("Authentication Error", "Please log in again.");
             // router.replace('/login');
        } else if (err.message?.includes('Network Error')) {
             errorMessage = "Network error. Please check connection.";
             Alert.alert("Network Error", errorMessage);
        } else { // Catch frontend validation errors or others
            errorMessage = err.message || "An unknown error occurred.";
            Alert.alert("Error", errorMessage);
        }
        setError(errorMessage); // Set error state for display
    } finally {
        setIsSaving(false); // Saving action complete
    }
  };

  // --- Helper Functions (Days, AdjustValue, Dosages) ---
  const toggleDay = (day) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const adjustValue = (setter, currentValue, increment) => {
    // Ensure we are working with numbers and allow 0
    setter(Math.max(0, (parseInt(currentValue, 10) || 0) + increment));
  };

  const updateDosageAmount = (index, change) => {
      const newDosages = [...dosages];
      if (!newDosages[index]) return; // Safety check
      const currentAmount = parseFloat(newDosages[index].amount) || 0;
      // Allow increments/decrements, ensure minimum is reasonable (e.g., 0.1 or 1 based on med type)
      newDosages[index].amount = Math.max(0.1, currentAmount + change).toFixed(1); // Example: allows decimals, min 0.1
      setDosages(newDosages);
  };

  const addDosageRow = () => {
    setDosages([...dosages, { id: `temp-${Date.now()}`, amount: 1, time: '09:00' }]); // Default new row
  };

  const removeDosageRow = (idToRemove) => {
    if (dosages.length <= 1) {
        Alert.alert("Cannot Remove", "You must have at least one dosage time.");
        return;
    }
    setDosages(dosages.filter(d => d.id !== idToRemove));
  };

  // --- Time Picker Functions ---
  const openTimePicker = (index) => {
      if (isSaving) return; // Prevent opening while saving
      setCurrentDosageIndex(index);
      const currentTime = dosages[index]?.time || '09:00'; // Default to 9 AM if undefined
      setTimePickerValue(parseTimeString(currentTime));
      setShowTimePicker(true);
  };

  const onChangeTime = (event, selectedDate) => {
      const requiresHiding = Platform.OS === 'android'; // Android hides automatically after event
      if (requiresHiding) {
        setShowTimePicker(false);
      }

      if (event.type === 'set' && selectedDate && currentDosageIndex !== null) {
          // On iOS, hide manually only after 'set' event is confirmed
          if (Platform.OS === 'ios') {
                setShowTimePicker(false);
          }
          const formattedTime = formatTime(selectedDate);
          const newDosages = [...dosages];
          if(newDosages[currentDosageIndex]) {
              newDosages[currentDosageIndex].time = formattedTime;
              setDosages(newDosages);
          }
          setCurrentDosageIndex(null); // Reset index after update
      } else if (event.type === 'dismissed') {
            // Ensure picker is hidden on dismiss for iOS
            if (Platform.OS === 'ios') {
                setShowTimePicker(false);
            }
            setCurrentDosageIndex(null); // Reset index on dismiss
      }
  };
  // --- ---

  // --- Render ---
  // Initial Loading State
  if (isLoading) {
      return (
          <View style={[styles.container, styles.centered]}>
              <ActivityIndicator size="large" color="#CC7755" />
              <Text style={styles.loadingText}>Loading Medication...</Text>
          </View>
      );
  }

  // Error State after fetch failed (and couldn't load initial data)
  if (error && !medicineName) {
      return (
          <View style={[styles.container, styles.centered]}>
              <Text style={styles.errorText}>Error: {error}</Text>
              <TouchableOpacity style={styles.saveButton} onPress={() => router.back()}>
                  <Text style={styles.saveButtonText}>Go Back</Text>
              </TouchableOpacity>
          </View>
      );
  }

  // Main Content
  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Display non-critical errors (e.g., save errors) at the top */}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Medicine Name Input */}
      <View style={styles.medicationName}>
         <TextInput
           placeholder="Medicine Name"
           placeholderTextColor="rgb(150,150,150)"
           style={styles.nameInput}
           value={medicineName}
           onChangeText={setMedicineName}
           editable={!isSaving} // Disable while saving
         />
      </View>

      {/* Frequency */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Frequency</Text>
        <View style={styles.daysContainer}>
            <View style={styles.daysRow}>
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday'].map(day => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayButton, selectedDays.includes(day) && styles.selectedDay]}
                  onPress={() => toggleDay(day)} disabled={isSaving}>
                  <Text style={[styles.dayText, selectedDays.includes(day) && styles.selectedDayText]}>{day.substring(0, 3)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.daysRow}>
               {['Thursday', 'Friday', 'Saturday'].map(day => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayButton, selectedDays.includes(day) && styles.selectedDay]}
                  onPress={() => toggleDay(day)} disabled={isSaving}>
                  <Text style={[styles.dayText, selectedDays.includes(day) && styles.selectedDayText]}>{day.substring(0, 3)}</Text>
                </TouchableOpacity>
              ))}
               <View style={[styles.dayButton, {backgroundColor: 'transparent'}]} />{/* Placeholder */}
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
          <View style={{width: 30}} /> {/* Spacer */}
        </View>

        {(dosages || []).map((dosage, index) => (
          <View key={dosage.id} style={styles.dosageRow}>
            {/* Dosage Amount */}
            <View style={styles.dosageControl}>
               <Text style={styles.dosageValue}>{dosage.amount}</Text>
               <View style={styles.dosageButtons}>
                 <TouchableOpacity onPress={() => updateDosageAmount(index, 0.5)} disabled={isSaving}>
                   <Feather name="chevron-up" size={18} color="#333" />
                 </TouchableOpacity>
                 <TouchableOpacity onPress={() => updateDosageAmount(index, -0.5)} disabled={isSaving}>
                   <Feather name="chevron-down" size={18} color="#333" />
                 </TouchableOpacity>
               </View>
             </View>
             {/* Time Button */}
            <TouchableOpacity style={styles.timeButton} onPress={() => openTimePicker(index)} disabled={isSaving}>
              <Text style={styles.timeText}>{dosage.time || 'Set Time'}</Text>
              <Feather name="clock" size={16} color="white" style={{ marginLeft: 5 }}/>
            </TouchableOpacity>
             {/* Remove Button */}
             <TouchableOpacity onPress={() => removeDosageRow(dosage.id)} style={styles.removeDosageButton} disabled={isSaving}>
                 <Feather name="minus-circle" size={20} color="#d9534f" />
             </TouchableOpacity>
          </View>
        ))}
      </View>

       {/* --- Time Picker Modal (Rendered Conditionally) --- */}
      {showTimePicker && (
        <DateTimePicker
          testID="dateTimePicker"
          value={timePickerValue} // Current time for the picker
          mode="time"
          is24Hour={true} // Use 24hr format
          display={Platform.OS === 'ios' ? 'spinner' : 'default'} // Style suggestion
          onChange={onChangeTime}
        />
      )}
       {/* --- --- */}


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

      <View style={styles.slotContainer}>
        <Text style={styles.inlineControlLabel}>Select Slot Number (1-4)</Text>
        <View style={styles.slotControl}>
          <Text style={styles.slotValue}>{slotNumber}</Text>
          <View style={styles.slotButtons}>
            <TouchableOpacity
              onPress={() => adjustValue(setSlotNumber, slotNumber, 1, 1, 4)}
              disabled={slotNumber >= 4}
            >
              <Feather name="chevron-up" size={18} color={slotNumber >= 4 ? "#ccc" : "#333"} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => adjustValue(setSlotNumber, slotNumber, -1, 1, 4)}
              disabled={slotNumber <= 1}
            >
              <Feather name="chevron-down" size={18} color={slotNumber <= 1 ? "#ccc" : "#333"} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
           
      

      {/* Update Button */}
      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} // Style disabled button
        onPress={onUpdate} // Call onUpdate function
        disabled={isSaving || isLoading} // Disable if fetching or saving
        >
        <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Update Medication'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

// --- Styles ---
// (Using the styles from the previous Update screen example)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  centered: { // Added for loading/error centering
      justifyContent: 'center',
      alignItems: 'center',
  },
    loadingText: {
        textAlign: 'center',
        marginTop: 10,
        fontSize: 18,
        color: 'grey',
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginVertical: 10,
        paddingHorizontal: 10,
        fontWeight: '500', // Make error text slightly bolder
    },
  medicationName: {
    marginVertical: 16,
    paddingHorizontal: 10,
  },
    nameInput: {
        textAlign: "center",
        fontWeight: "bold",
        fontSize: 18,
        color: '#333',
        backgroundColor: 'white',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#ddd',
   },
  sectionContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    color: '#444',
  },
    scheduleTitleContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
   },
    addDosageButton: {
        position: 'absolute',
        right: 0,
        padding: 5,
   },
  daysContainer: {
    alignItems: 'stretch',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  dayButton: {
    backgroundColor: '#CC7755',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 15,
    margin: 4,
    minWidth: 50, // Adjust as needed for text length
    alignItems: 'center',
  },
  selectedDay: {
    backgroundColor: '#a1887f',
  },
  dayText: {
    color: 'white',
    fontSize: 13, // Adjusted from update screen
    fontWeight: '500',
  },
  selectedDayText: {
    fontWeight: 'bold',
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 5,
  },
  scheduleHeaderText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    flex: 1,
    textAlign: 'center',
  },
  dosageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 5,
  },
  dosageControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
    width: '35%', // Adjusted width
    marginRight: 8,
    justifyContent: 'space-between'
  },
  dosageValue: {
    textAlign: 'center',
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
    marginHorizontal: 5,
  },
  dosageButtons: {
    alignItems: 'center',
  },
  timeButton: {
    backgroundColor: '#CC7755',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    width: '45%', // Adjusted width
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  timeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
    removeDosageButton: {
        padding: 5,
        width: 30,
        alignItems: 'center',
   },
  stockReminderRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-start',
  },
  inlineControlContainer: {
      alignItems: 'center',
      width: '45%',
  },
  inlineControlLabel: {
      fontSize: 13,
      color: '#666',
      marginBottom: 5,
  },
  stockControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
    width: '100%',
    justifyContent: 'space-between'
  },
  stockValue: {
    textAlign: 'center',
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
     marginHorizontal: 5,
  },
  stockButtons: {
    alignItems: 'center',
  },
  reminderControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
    width: '100%',
    justifyContent: 'space-between'
  },
  reminderValue: {
    textAlign: 'center',
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
    marginHorizontal: 5,
  },
  reminderButtons: {
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#CC7755',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  saveButtonDisabled: {
      backgroundColor: '#cccccc',
  },
  slotContainer: {
    alignItems: "center",
    marginTop: 5,
  },
  slotControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 8,
    width: "50%", // Make it a bit wider than the other controls
  },
  slotValue: {
    flex: 1,
    textAlign: "center",
    color: "#333",
    fontWeight: "bold",
    fontSize: 16,
  },
  slotButtons: {
    alignItems: "center",
    marginLeft: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default MedicationUpdateScreen;