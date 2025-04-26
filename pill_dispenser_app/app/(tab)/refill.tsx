import React, { useState, useEffect, useCallback } from 'react'; // Import useCallback
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator // Import Alert and ActivityIndicator
} from 'react-native';
import { useRouter, useFocusEffect } from "expo-router"; // Import useFocusEffect
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage

// *** Use your correct, consistent backend IP/URL ***
const API_BASE_URL = "http://192.168.1.104:8000"; // Make sure this IP is correct and consistent
const MEDICATIONS_ENDPOINT = `${API_BASE_URL}/api/medications/`;

const RefillScreen = () => {
  const [medications, setMedications] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // Loading state for fetching
  const [error, setError] = useState(null); // Error state for fetching
  // Optional: More granular loading state for updates
  const [updatingStockId, setUpdatingStockId] = useState(null);
  const router = useRouter();

  // --- Fetch Medications ---
  const fetchMedications = useCallback(async () => { // Wrap in useCallback
    setIsLoading(true);
    setError(null);
    let token = null;

    try {
      token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        throw new Error("User not authenticated.");
      }

      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      console.log("RefillScreen: Fetching medications...");
      const response = await axios.get(MEDICATIONS_ENDPOINT, config); // Use consistent endpoint and add config
      setMedications(response.data);

    } catch (err) {
      console.error("RefillScreen: Error fetching medications:", err.response?.data || err.message);
      setError("Failed to load medication stock levels."); // Set user-friendly error
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        setError("Authentication failed. Please log in again.");
        // Optional: Clear token and redirect
        // await AsyncStorage.removeItem('accessToken');
        // router.replace('/login');
      } else if (err.message === "User not authenticated.") {
         setError(err.message); // Show specific auth error
         // router.replace('/login');
      }
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  // Use useFocusEffect to fetch data when the screen is focused
  useFocusEffect(fetchMedications);

  // --- Update Stock ---
  const updateMedicationStock = async (medicationId, newStock) => {
    // Prevent negative stock if logic requires it (already handled by Math.max in onPress, but good defense)
    if (newStock < 0) return;

    setUpdatingStockId(medicationId); // Indicate which item is loading
    let token = null;

    try {
      token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert("Authentication Required", "Please log in.");
        setUpdatingStockId(null);
        return;
      }

      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      const data = { stock: newStock }; // Send only the stock field for PATCH

      console.log(`Updating stock for ID ${medicationId} to ${newStock}`);
      // Use PATCH for partial updates (only sending 'stock')
      const response = await axios.patch(`${MEDICATIONS_ENDPOINT}${medicationId}/`, data, config);

      // Update local state ONLY AFTER successful backend update
      if (response.status === 200) { // Check for success status (usually 200 OK for PATCH/PUT)
           setMedications(currentMedications =>
             currentMedications.map(medication =>
               medication.id === medicationId
                 ? { ...medication, stock: newStock } // Update the correct medication
                 : medication
             )
           );
            // Optional: Brief success feedback? Less disruptive without Alert.
      } else {
           throw new Error(`Server responded with status ${response.status}`);
      }

    } catch (error) {
      console.error("Error updating medication stock:", error.response?.data || error.message);
      // Provide specific feedback based on error
       if (error.response && (error.response.status === 401 || error.response.status === 403)) {
           Alert.alert("Authentication Failed", "Your session may have expired or you lack permission.");
           // router.replace('/login');
       } else if (error.response && error.response.status === 404) {
           Alert.alert("Error", `Medication with ID ${medicationId} not found.`);
           // Optionally remove it from local state if not found on server
           setMedications(prevMeds => prevMeds.filter(med => med.id !== medicationId));
       } else if (error.response && error.response.status === 400) {
            Alert.alert("Error", `Invalid data for stock update: ${JSON.stringify(error.response.data)}`);
       }
       else {
           Alert.alert("Error", "Failed to update medication stock. Please try again.");
       }
    } finally {
      setUpdatingStockId(null); 
    }
  };

  // --- Render Logic ---
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.listContainer}>

        {isLoading && <ActivityIndicator size="large" color="#CC7755" style={{ marginTop: 20 }} />}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {!isLoading && !error && medications.length === 0 && (
            <Text style={styles.emptyText}>No medications found.</Text>
        )}

        {!isLoading && medications.length > 0 && medications.map((medication) => {
            const isUpdating = updatingStockId === medication.id; // Check if this item is currently updating
            return (
                // Use medication.id as key
                <View key={medication.id} style={styles.medicationItem}>
                    <View style={styles.medicineRow}>
                    <Text style={styles.medicineName}>{medication.name}</Text>
                    <View style={styles.stockContainer}>
                        {/* Decrease Button */}
                        <TouchableOpacity
                        style={[styles.stockButton, isUpdating && styles.stockButtonDisabled]} // Disable style
                        onPress={() => updateMedicationStock(
                            medication.id,
                            Math.max(0, medication.stock - 1) // Ensure stock doesn't go below 0
                        )}
                        disabled={isUpdating} // Disable button
                        >
                        <Text style={styles.stockButtonText}>-</Text>
                        </TouchableOpacity>

                        {/* Stock Value / Indicator */}
                        <View style={styles.stockTextContainer}>
                            {isUpdating ? (
                                <ActivityIndicator size="small" color="#CC7755" />
                            ) : (
                                <Text style={styles.stockText}>{medication.stock}</Text>
                            )}
                        </View>


                        {/* Increase Button */}
                        <TouchableOpacity
                        style={[styles.stockButton, isUpdating && styles.stockButtonDisabled]} // Disable style
                        onPress={() => updateMedicationStock(
                            medication.id,
                            medication.stock + 1
                        )}
                         disabled={isUpdating} // Disable button
                        >
                        <Text style={styles.stockButtonText}>+</Text>
                        </TouchableOpacity>
                    </View>
                    </View>
                </View>
            );
        })}
    </ScrollView>
  );
};

// --- Styles --- (Combine and refine styles)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Lighter background
  },
  listContainer: {
    padding: 20,
    paddingBottom: 40, // Ensure space at bottom
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
   errorText: {
        color: 'red',
        textAlign: 'center',
        marginVertical: 15,
        fontSize: 16,
   },
   emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: 'grey',
        fontSize: 16,
   },
  medicationItem: { // Container for each row
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 12, // Space between items
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden', // Ensures shadow respects border radius
  },
  medicineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  medicineName: {
    fontSize: 16,
    fontWeight: '500', // Slightly bolder
    flex: 1, // Take available space
    marginRight: 10, // Space before stock controls
    color: '#444',
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockButton: {
    backgroundColor: '#CC7755', // Theme color
    width: 32, // Slightly larger tap area
    height: 32,
    borderRadius: 16, // Circular
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5, // Add slight horizontal margin
     shadowColor: '#000', // Subtle shadow for buttons
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
   stockButtonDisabled: {
        backgroundColor: '#cccccc', // Grey out when disabled
   },
  stockButtonText: {
    color: 'white',
    fontSize: 20, // Larger + / -
    fontWeight: 'bold',
    lineHeight: 22, // Adjust line height for vertical centering
  },
   stockTextContainer: { // Container to hold text or indicator
        minWidth: 40, // Ensure space for number or indicator
        height: 30, // Match button height roughly
        marginHorizontal: 10,
        justifyContent: 'center',
        alignItems: 'center',
   },
  stockText: {
    fontSize: 17,
    fontWeight: '600', // Bolder stock number
    textAlign: 'center',
    color: '#333',
  },
  // Remove medicationList and medicationItem duplicate styles if they were separate
});

export default RefillScreen;