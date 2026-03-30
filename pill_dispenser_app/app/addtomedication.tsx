import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Platform } from 'react-native'; // Import Alert
import { Feather } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams} from "expo-router"; // Add useLocalSearchParams if not already there
import { API_BASE_URL, MEDICATIONS_ENDPOINT, TOKEN_REFRESH_ENDPOINT } from '../utils/apiConfig';

// --- ---
const parseTimeString = (timeString = "09:00") => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date(); // Use today's date as a base
  date.setHours(hours || 9); // Default to 9 if parsing fails
  date.setMinutes(minutes || 0); // Default to 0 if parsing fails
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date;
};

const formatTime = (date) => {
  if (!date) return '00:00';
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const MedicationEditDetailScreen = () => { // Removed navigation prop if using expo-router
  const router = useRouter();
  const params = useLocalSearchParams();

  const prefilledNameFromParams = params?.prefilledName || '';
  console.log("Extracted prefilledNameFromParams:", prefilledNameFromParams);

  // --- State Variables ---
  const [medicineName, setMedicineName] = useState(prefilledNameFromParams);
  console.log("Initial medicineName state:", medicineName);
  // Use full day names consistent with backend signals.py
  const [selectedDays, setSelectedDays] = useState([]);
  const [dosages, setDosages] = useState([
    // Provide unique IDs, perhaps using Date.now() or a UUID library when adding new ones
    { id: Date.now(), amount: 1, time: '09:00' },
  ]);
  const [stock, setStock] = useState(10); // Sensible defaults
  const [reminder, setReminder] = useState(5); // Sensible defaults (e.g., 5 minutes)
  const [isLoading, setIsLoading] = useState(false);
  // --- ---
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date()); // Holds the date/time for the picker
  const [editingDosageIndex, setEditingDosageIndex] = useState(-1); // Index of dosage being edited

  // --- Handlers ---
  const onSave = async () => {
    setIsLoading(true);

    // 1. Get Auth Token and User ID
    let token = null;
    let userId = null;
    try {
      token = await AsyncStorage.getItem('accessToken');
      // ** ASSUMPTION: You stored the user's ID as 'userId' during/after login **
      // If not, you might need to fetch user details using the token first.
      const storedUserId = await AsyncStorage.getItem('userId');
      userId = storedUserId ? parseInt(storedUserId, 10) : null; // Convert stored ID string to number

      if (!token || !userId) {
        Alert.alert("Authentication Error", "Could not find user session. Please log in again.");
        router.replace('/login'); // Redirect to login
        setIsLoading(false);
        return;
      }
    } catch (e) {
      console.error("Failed to retrieve auth data:", e);
      Alert.alert("Error", "Failed to retrieve user session.");
      setIsLoading(false);
      return;
    }

    // 2. Prepare Data Payload (including user ID)
    const data = {
      name: medicineName,
      selected_days: selectedDays, // Send full day names
      dosages: dosages.map(d => ({ amount: d.amount, time: d.time })), // Send only needed data, ensure time format is HH:MM
      stock: stock,
      reminder: reminder,
      user: userId // *** Include the user ID ***
    };

    // Basic Validation
    if (!data.name) {
        Alert.alert("Validation Error", "Please enter a medicine name.");
        setIsLoading(false);
        return;
    }
     if (data.selected_days.length === 0) {
        Alert.alert("Validation Error", "Please select at least one day.");
        setIsLoading(false);
        return;
    }
     if (data.dosages.length === 0) {
        Alert.alert("Validation Error", "Please add at least one dosage time.");
        setIsLoading(false);
        return;
    }
    // Add more validation as needed (time format, amounts > 0 etc.)


    // 3. Prepare Request Configuration (with Auth Header)
    const config = {
      headers: {
        'Authorization': `Bearer ${token}`, // Use Bearer for Simple JWT
        'Content-Type': 'application/json', // Explicitly set content type
      }
    };

    // 4. Make Authenticated API Call
    try {
      const response = await axios.post(MEDICATIONS_ENDPOINT, data, config);

      if (response.status === 201) { // HTTP 201 Created
        Alert.alert("Success", "Medication saved successfully!");
        // Navigate back or to the main list after saving
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace("/prescription"); // Fallback navigation
        }
      } else {
        // This case might not be reached often if axios throws for non-2xx status
        Alert.alert("Save Failed", `Server responded with status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error saving medication:", error.response?.data || error.message);
       if (error.response) {
            // Handle specific backend errors (like validation errors)
             if (error.response.status === 401 || error.response.status === 403) {
                 Alert.alert("Authentication Failed", "Your session may have expired. Please log in again.");
                 router.replace('/login');
             } else if (error.response.data) {
                 // Try to format DRF validation errors
                 const errorMessages = Object.entries(error.response.data).map(([field, messages]) =>
                    `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`
                 ).join('\n');
                 Alert.alert("Save Failed", `Please correct the following:\n${errorMessages || 'Unknown server error'}`);
             } else {
                  Alert.alert("Save Failed", `Server error: ${error.response.status}`);
             }
       } else {
           // Handle network errors
           Alert.alert("Network Error", "Could not connect to the server. Please check your connection.");
       }
    } finally {
      setIsLoading(false);
    }
  };


  const toggleDay = (day) => {
    // Use full day names for toggling logic
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const adjustValue = (setter, currentValue, increment) => {
      // Allow stock/reminder to be 0 or positive
    setter(Math.max(0, currentValue + increment));
  };

  // --- TODO: Add functions for adding/removing/editing dosage times ---
  // Example:
  const addDosageRow = () => {
      setDosages([...dosages, { id: Date.now(), amount: 1, time: '08:00' }]); // Add new default row
  };

  const removeDosageRow = (idToRemove) => {
      if (dosages.length <= 1) {
          Alert.alert("Cannot Remove", "You must have at least one dosage time.");
          return;
      }
      setDosages(dosages.filter(d => d.id !== idToRemove));
  };

  // NOTE: Editing dosage time requires implementing a Time Picker modal.
  // Placeholder function for where you'd trigger the time picker for a specific index/id.
  const openTimePicker = (index) => {
    console.log("openTimePicker called for index:", index);
    if (isLoading) return; // Don't open picker while saving
    const currentTime = dosages[index]?.time || '09:00'; // Get current time or default
    setEditingDosageIndex(index); // Remember which dosage we are editing
    setPickerDate(parseTimeString(currentTime)); // Set picker initial value
    console.log("Setting showPicker to true");
    setShowPicker(true); // Show the picker UI
  };

  // *** 4. Implement onChange handler for the picker ***
  const onTimeChange = (event, selectedDate) => {
    // Always hide picker on Android after interaction
    if (Platform.OS === 'android') {
        setShowPicker(false);
    }

    // Check if a date was selected (dismissed event won't have selectedDate on some platforms)
    if (event.type === 'set' && selectedDate) {
        const newTime = formatTime(selectedDate); // Format to HH:MM

        // Update the specific dosage time in the state
        if (editingDosageIndex >= 0) {
            const newDosages = [...dosages]; // Create a copy
            newDosages[editingDosageIndex].time = newTime; // Update the time
            setDosages(newDosages); // Set the new state
        }
         // On iOS, user has to explicitly dismiss, so keep picker visible until they do
         // If you want iOS to hide immediately after setting, uncomment below:
         // if (Platform.OS === 'ios') {
         //     setShowPicker(false);
         // }
    } else {
        // Handle cancellation/dismissal if needed
        console.log("Time picker dismissed or no date selected.");
         // Ensure picker is hidden on dismiss for iOS as well if it wasn't hidden by 'set'
         if (Platform.OS === 'ios') {
             setShowPicker(false);
         }
    }

    // Reset editing index (optional, depends on flow)
     // setEditingDosageIndex(-1);
  };



  // --- Render ---
  return (
    <ScrollView style={styles.container}>
      {/* Medicine Name Input */}
      <View style={styles.medicationName}>
        <TextInput
          placeholder="Medicine Name"
          placeholderTextColor="rgb(150,150,150)" // Lighter placeholder
          style={styles.nameInput} // Use dedicated style
          value={medicineName}
          onChangeText={setMedicineName}
        />
      </View>

      {/* Frequency Section */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Frequency</Text>
        <View style={styles.daysContainer}>
          {/* Render buttons based on full day names */}
          {/* Example for Sunday - Repeat for others */}
          <View style={styles.daysRow}>
             <TouchableOpacity
                style={[styles.dayButton, selectedDays.includes('Sunday') && styles.selectedDay]}
                onPress={() => toggleDay('Sunday')}
             >
                <Text style={[styles.dayText, selectedDays.includes('Sunday') && styles.selectedDayText]}>Sunday</Text>
             </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dayButton, selectedDays.includes('Monday') && styles.selectedDay]}
                onPress={() => toggleDay('Monday')}
             >
                <Text style={[styles.dayText, selectedDays.includes('Monday') && styles.selectedDayText]}>Monday</Text>
             </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dayButton, selectedDays.includes('Tuesday') && styles.selectedDay]}
                onPress={() => toggleDay('Tuesday')}
             >
                <Text style={[styles.dayText, selectedDays.includes('Tuesday') && styles.selectedDayText]}>Tuesday</Text>
             </TouchableOpacity>
             <TouchableOpacity
                style={[styles.dayButton, selectedDays.includes('Wednesday') && styles.selectedDay]}
                onPress={() => toggleDay('Wednesday')}
             >
                <Text style={[styles.dayText, selectedDays.includes('Wednesday') && styles.selectedDayText]}>Wednesday</Text>
             </TouchableOpacity>
          </View>
          <View style={styles.daysRow}>
              <TouchableOpacity
                style={[styles.dayButton, selectedDays.includes('Thursday') && styles.selectedDay]}
                onPress={() => toggleDay('Thursday')}
             >
                <Text style={[styles.dayText, selectedDays.includes('Thursday') && styles.selectedDayText]}>Thursday</Text>
             </TouchableOpacity>
             <TouchableOpacity
                style={[styles.dayButton, selectedDays.includes('Friday') && styles.selectedDay]}
                onPress={() => toggleDay('Friday')}
             >
                <Text style={[styles.dayText, selectedDays.includes('Friday') && styles.selectedDayText]}>Friday</Text>
             </TouchableOpacity>
             <TouchableOpacity
                style={[styles.dayButton, selectedDays.includes('Saturday') && styles.selectedDay]}
                onPress={() => toggleDay('Saturday')}
             >
                <Text style={[styles.dayText, selectedDays.includes('Saturday') && styles.selectedDayText]}>Saturday</Text>
             </TouchableOpacity>
             {/* Add an empty view or adjust styling if needed to align last row */}
             <View style={{ width: styles.dayButton.paddingHorizontal * 2 + styles.dayButton.marginHorizontal * 2 + 40 }} />
          </View>
        </View>
      </View>

      {/* Schedule Section */}
      <View style={styles.sectionContainer}>
        <View style={styles.scheduleTitleContainer}>
             <Text style={styles.sectionTitle}>Schedule</Text>
             <TouchableOpacity onPress={addDosageRow} style={styles.addDosageButton}>
                 <Feather name="plus-circle" size={22} color="#CC7755" />
             </TouchableOpacity>
        </View>
        <View style={styles.scheduleHeader}>
          <Text style={styles.scheduleHeaderText}>Dosage</Text>
          <Text style={styles.scheduleHeaderText}>Time</Text>
           <View style={{width: 30}} /> {/* Spacer for remove button */}
        </View>

        {dosages.map((dosage, index) => (
          <View key={dosage.id} style={styles.dosageRow}>
            {/* Dosage Amount Control */}
            <View style={styles.dosageControl}>
               <Text style={styles.dosageValue}>{dosage.amount}</Text>
               <View style={styles.dosageButtons}>
                 <TouchableOpacity onPress={() => {
                   const newDosages = [...dosages];
                   newDosages[index].amount++;
                   setDosages(newDosages);
                 }}>
                   <Feather name="chevron-up" size={18} color="#333" />
                 </TouchableOpacity>
                 <TouchableOpacity onPress={() => {
                   const newDosages = [...dosages];
                   // Allow amount to be 1
                   newDosages[index].amount = Math.max(1, newDosages[index].amount - 1);
                   setDosages(newDosages);
                 }}>
                   <Feather name="chevron-down" size={18} color="#333" />
                 </TouchableOpacity>
               </View>
             </View>

            {/* Time Control (Needs Time Picker Implementation) */}
            {/* When this button is pressed, it should open the time picker */}
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => openTimePicker(index)} // Call the function to show picker
              disabled={isLoading}
            >
              <Text style={styles.timeText}>{dosage.time}</Text>
              <Feather name="clock" size={16} color="white" style={{ marginLeft: 5 }} />
            </TouchableOpacity>

             {/* Remove Dosage Row Button */}
             <TouchableOpacity onPress={() => removeDosageRow(dosage.id)} style={styles.removeDosageButton} disabled={isLoading}>
                 <Feather name="minus-circle" size={20} color="#d9534f" />
             </TouchableOpacity>

          </View>
        ))}
      </View>

      {showPicker && (
        <DateTimePicker
          testID="dateTimePicker"
          value={pickerDate}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onTimeChange}
        />
      )}

      {/* Stock Section */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Stock & Reminder</Text>
        <View style={styles.stockReminderRow}>
            {/* Stock Control */}
             <View style={styles.inlineControlContainer}>
                  <Text style={styles.inlineControlLabel}>Current Stock</Text>
                  <View style={styles.stockControl}>
                    <Text style={styles.stockValue}>{stock}</Text>
                    <View style={styles.stockButtons}>
                      <TouchableOpacity onPress={() => adjustValue(setStock, stock, 1)}>
                        <Feather name="chevron-up" size={18} color="#333" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => adjustValue(setStock, stock, -1)}>
                        <Feather name="chevron-down" size={18} color="#333" />
                      </TouchableOpacity>
                    </View>
                  </View>
            </View>
            {/* Reminder Control */}
            <View style={styles.inlineControlContainer}>
                <Text style={styles.inlineControlLabel}>Remind (mins before)</Text>
                 <View style={styles.reminderControl}>
                    <Text style={styles.reminderValue}>{reminder}</Text>
                    <View style={styles.reminderButtons}>
                      <TouchableOpacity onPress={() => adjustValue(setReminder, reminder, 1)}>
                        <Feather name="chevron-up" size={18} color="#333" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => adjustValue(setReminder, reminder, -1)}>
                        <Feather name="chevron-down" size={18} color="#333" />
                      </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
         style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} // Style disabled button
         onPress={onSave}
         disabled={isLoading} // Disable button while loading
        >
        <Text style={styles.saveButtonText}>{isLoading ? 'Saving...' : 'Save Medication'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

// --- Styles ---
// (Add/Modify styles as needed for new elements)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  medicationName: { // Container for the input
    marginVertical: 16,
    paddingHorizontal: 10, // Add some padding
  },
   nameInput: { // Style for the TextInput itself
       textAlign: "center",
       fontWeight: "bold",
       fontSize: 18,
       color: '#333', // Darker text color
       backgroundColor: 'white', // White background
       borderRadius: 8,
       paddingVertical: 12,
       paddingHorizontal: 15,
       borderWidth: 1,
       borderColor: '#ddd', // Light border
   },
  sectionContainer: {
    backgroundColor: '#ffffff', // Brighter background
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000', // Add shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 17, // Slightly larger title
    fontWeight: '600', // Bolder
    textAlign: 'center',
    marginBottom: 16, // More space below title
    color: '#444', // Darker title color
  },
   scheduleTitleContainer: { // To hold title and add button
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
   },
   addDosageButton: {
        position: 'absolute', // Position independently
        right: 0, // Align to the right of the container
        padding: 5,
   },
  daysContainer: {
    alignItems: 'stretch', // Stretch rows
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'center', // Center buttons in the row
    marginBottom: 8,
    flexWrap: 'wrap', // Allow wrapping if needed on smaller screens
  },
  dayButton: {
    backgroundColor: '#CC7755', // Slightly different default color
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 15,
    margin: 4, // Use margin for spacing
    minWidth: 50, // Ensure minimum width
    alignItems: 'center', // Center text inside button
  },
  selectedDay: {
    backgroundColor: '#a1887f', // Keep selected color distinct
  },
  dayText: {
    color: 'white',
    fontSize: 13,
  },
  selectedDayText: {
    fontWeight: 'bold',
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5, // Adjust padding
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 5,
  },
  scheduleHeaderText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    flex: 1, // Allow text to take up space
    textAlign: 'center',
  },
  dosageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', // Align items vertically
    marginBottom: 12, // More space between rows
    paddingHorizontal: 5,
  },
  dosageControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0', // Lighter background for controls
    borderRadius: 8,
    padding: 8,
    // width: '40%', // Let flexbox handle width better
    flex: 2, // Give it more space
    marginRight: 8, // Add spacing
  },
  dosageValue: {
    flex: 1,
    textAlign: 'center',
    color: '#333', // Darker text
    fontWeight: 'bold',
    fontSize: 16,
  },
  dosageButtons: {
    alignItems: 'center',
    marginLeft: 8, // Space before buttons
  },
  timeButton: {
    backgroundColor: '#CC7755',
    borderRadius: 8,
    paddingVertical: 12, // Make buttons taller
    paddingHorizontal: 10,
    // width: '40%', // Let flexbox handle width
    flex: 2, // Give it same space as dosage
    flexDirection: 'row', // To align icon and text
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8, // Add spacing
  },
  timeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
   removeDosageButton: {
        padding: 5, // Make it easier to press
   },
  stockReminderRow: { // Container for stock and reminder side-by-side
      flexDirection: 'row',
      justifyContent: 'space-around', // Space them out
      alignItems: 'flex-start', // Align tops
  },
  inlineControlContainer: { // Container for label + control
      alignItems: 'center',
      width: '45%', // Roughly half width
  },
  inlineControlLabel: {
      fontSize: 13,
      color: '#666',
      marginBottom: 5,
  },
  stockControl: { // Styles specific to stock input group
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
    width: '100%', // Take full width of its container
  },
  stockValue: {
    flex: 1,
    textAlign: 'center',
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  stockButtons: {
    alignItems: 'center',
    marginLeft: 8,
  },
  reminderControl: { // Styles specific to reminder input group
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
    width: '100%', // Take full width of its container
  },
  reminderValue: {
    flex: 1,
    textAlign: 'center',
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  reminderButtons: {
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButton: { // Renamed from editButton for clarity
    backgroundColor: '#CC7755', // Use theme color
    borderRadius: 25, // Rounded corners
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10, // Add margin top
    marginBottom: 20,
  },
  saveButtonDisabled: { // Style for when button is disabled
      backgroundColor: '#cccccc', // Grey out when disabled
  },
  saveButtonText: { // Renamed from editButtonText
    fontSize: 16, // Larger text
    fontWeight: '600', // Bolder
    color: 'white', // White text
  },
});

export default MedicationEditDetailScreen;