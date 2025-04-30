import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"; // Import useFocusEffect
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = "http://192.168.1.67:8000";
const USER_MEDICATIONS_ENDPOINT = `${API_BASE_URL}/api/medications/`; 

const PrescriptionReviewScreen = () => {
    const params = useLocalSearchParams();
    const { prescriptionId, imageUri } = params;
    const router = useRouter();

    // --- State Variables ---
    const [detectedMedicines, setDetectedMedicines] = useState([]); 
    const [isLoading, setIsLoading] = useState(true); 
    const [imageWidth, setImageWidth] = useState(0);
    const [imageHeight, setImageHeight] = useState(0);
    const [savedMedicationNames, setSavedMedicationNames] = useState(new Set()); 

    // --- Navigation ---
    const navigateToMedicationForm = (medicineName) => {
        console.log("navigateToMedicationForm called with name:", medicineName);
        router.push({
            pathname: "/addtomedication", 
            params: { prefilledName: medicineName } 
        });
    };

    const fetchDetectedMedicines = async () => {
        setIsLoading(true);
        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) {
                Alert.alert("Authentication Required", "Please log in.");
                router.replace('/login');
                setIsLoading(false); 
                return;
            }
            const config = { headers: { 'Authorization': `Bearer ${token}` } };
            const response = await axios.get(
                `${API_BASE_URL}/api/prescriptions/${prescriptionId}/medicines/`,
                config
            );
            setDetectedMedicines(response.data);
        } catch (error) {
            console.error("Error fetching detected medicines:", error);
            Alert.alert("Error", "Failed to fetch detected medicines for this prescription.");
        } finally {
             setIsLoading(false);
        }
    };

    // Fetch the list of ALL medications the user has saved in their main list
    const fetchUserMedications = useCallback(async () => {
        console.log("Screen focused, fetching user's saved medications...");
        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) {
                console.warn("No token found, cannot fetch user medications.");
                return; // Don't proceed without a token
            }
            const config = { headers: { 'Authorization': `Bearer ${token}` } };

            // *** Use the correct endpoint defined above ***
            const response = await axios.get(USER_MEDICATIONS_ENDPOINT, config);

            // Assuming response.data is an array like: [{ id: 1, name: 'Aspirin' }, ...]
            if (Array.isArray(response.data)) {
                // Extract names and store them in a Set for efficient lookup
                const namesSet = new Set(response.data.map(med => med.name));
                setSavedMedicationNames(namesSet);
                console.log("Updated saved medication names:", namesSet);
            } else {
                console.error("Unexpected response format for user medications:", response.data);
            }
        } catch (error) {
            console.error("Error fetching user medications:", error);
            // Optional: Inform user, but maybe not critical for this specific feature
            // Alert.alert("Update Error", "Could not verify status of added medications.");
        }
    }, []); // useCallback dependency array is empty as the function itself doesn't depend on props/state

    // --- Effects ---

    // Effect to fetch detected medicines and get image size on initial load or when key params change
    // In PrescriptionReviewScreen.js
useEffect(() => {
    console.log("Prescription ID:", params.prescriptionId);
    console.log("Image URI:", params.imageUri);
    
    fetchDetectedMedicines();
  
    // Skip image processing if no imageUri
    if (!params.imageUri) {
      console.error("No imageUri provided");
      setIsLoading(false);
      return;
    }
  
    // Try using a fetch to validate the image URL first
    fetch(params.imageUri)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        console.log("Image fetch successful, status:", response.status);
        
        // Now try to get the image dimensions
        Image.getSize(
          params.imageUri,
          (width, height) => {
            console.log("Image dimensions:", width, "x", height);
            setImageWidth(width);
            setImageHeight(height);
          },
          (error) => {
            console.error("Image.getSize error:", error);
            // Continue with the app without the bounding boxes
            Alert.alert(
              "Warning",
              "Could not get image dimensions. Bounding boxes may be inaccurate."
            );
          }
        );
      })
      .catch(error => {
        console.error("Image fetch failed:", error);
        Alert.alert("Image Error", `Could not access image: ${error.message}`);
      });
  }, [params.prescriptionId, params.imageUri]); // Dependencies for this specific effect

    // Effect to fetch the user's saved medication list every time the screen comes into focus
    useFocusEffect(fetchUserMedications);

    // --- Render Logic ---

    if (isLoading) { // Show loading indicator only during the initial fetch
        return (
            <View style={styles.loadingContainer}>
                <Text>Loading detected medicines...</Text>
                {/* You could add an ActivityIndicator here */}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Review Detected Medications</Text>

            <View style={styles.imageContainer}>
                {imageUri ? (
                    <Image
                        source={{ uri: params.imageUri }}
                        style={styles.image}
                        resizeMode="contain"
                        onError={(e) => {
                            console.error("Image loading error:", e.nativeEvent.error);
                            Alert.alert("Image Error", `Failed to load image: ${e.nativeEvent.error}`);
                          }}
                    />
                 ) : (
                    <View style={styles.noImagePlaceholder}>
                        <Text>No image available</Text>
                    </View>
                )}

                {/* Draw bounding boxes */}
                {imageWidth > 0 && imageHeight > 0 && detectedMedicines.map((medicine) => (
                    <View
                        key={medicine.id}
                        style={[
                            styles.boundingBox,
                            {
                                left: typeof medicine.bbox_x === 'number' ? (medicine.bbox_x / imageWidth) * 300 : 0,
                                top: typeof medicine.bbox_y === 'number' ? (medicine.bbox_y / imageHeight) * 400 : 0,
                                width: typeof medicine.bbox_width === 'number' ? (medicine.bbox_width / imageWidth) * 300 : 0,
                                height: typeof medicine.bbox_height === 'number' ? (medicine.bbox_height / imageHeight) * 400 : 0,
                            }
                        ]}
                    />
                ))}
            </View>

            <ScrollView style={styles.medicineList}>
                {detectedMedicines.length === 0 && !isLoading && (
                    <Text style={styles.noMedicinesText}>No medicines detected in this prescription.</Text>
                )}
                {detectedMedicines.map((medicine) => {
                    // Check if this medicine name is in the set of user's saved names
                    const isAdded = savedMedicationNames.has(medicine.name);

                    return (
                        <View key={medicine.id} style={styles.medicineItem}>
                            <View style={styles.medicineDetails}>
                                <Text style={styles.medicineName}>{medicine.name || 'Unnamed Medicine'}</Text>
                                <Text style={styles.medicineFrequency}>
                                    Frequency: {medicine.frequency || 'Not specified'}
                                </Text>

                                {/* Conditionally render "Added" text or the "Add" button */}
                                {isAdded ? (
                                    <View style={styles.addedIndicator}>
                                        <Feather name="check-square" size={16} color="green" />
                                        <Text style={styles.addedText}>Added to My Med List</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.addButton}
                                        onPress={() => {
                                            console.log("Add button pressed for medicine:", JSON.stringify(medicine));
                                            // Ensure medicine.name is a string before navigating
                                            const nameToPass = typeof medicine.name === 'string' ? medicine.name : '';
                                             if (!nameToPass) {
                                                Alert.alert("Cannot Add", "Medicine name is missing.");
                                                return;
                                             }
                                            console.log("Attempting to navigate with name:", nameToPass);
                                            navigateToMedicationForm(nameToPass);
                                        }}
                                    >
                                        <Feather name="plus-square" size={16} color="#4a90e2" />
                                        <Text style={[styles.buttonText, { color: '#4a90e2' }]}>
                                            Add to My Med List
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>

            <TouchableOpacity
                style={styles.doneButton}
                onPress={() => router.back()}
            >
                <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
        </View>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    loadingContainer: { // Style for the loading view
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    imageContainer: {
        position: 'relative',
        width: 300, // Consider making these dynamic or constants
        height: 400,
        alignSelf: 'center',
        marginBottom: 20,
        backgroundColor: '#eee', // Background for placeholder/loading
         justifyContent: 'center', // Center placeholder text
         alignItems: 'center', // Center placeholder text
    },
    image: {
        width: '100%',
        height: '100%',
    },
    boundingBox: {
        position: 'absolute',
        borderWidth: 2,
        borderColor: '#4a90e2', // Blue border for bounding box
        backgroundColor: 'rgba(74, 144, 226, 0.1)', // Light blue fill
    },
    medicineList: {
        flex: 1,
        marginBottom: 10, // Add space before Done button
    },
    noMedicinesText: { // Style for when no medicines are detected
        textAlign: 'center',
        marginTop: 20,
        fontSize: 16,
        color: '#666',
    },
    medicineItem: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 15,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    medicineDetails: {
        flex: 1,
    },
    medicineName: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 5,
    },
    medicineFrequency: {
        fontSize: 14,
        color: '#666',
        marginBottom: 10,
    },
    addButton: { // Style for the Add button
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: 5,
        paddingHorizontal: 8,
        marginTop: 5,
    },
    buttonText: { // Text specific to buttons
        marginLeft: 5,
        fontSize: 14,
    },
    addedIndicator: { // Container for the "Added" status
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: 5,
        paddingHorizontal: 8,
        marginTop: 5,
    },
    addedText: { // Text for the "Added" status
        marginLeft: 5,
        fontSize: 14,
        color: 'green', // Green color for added status
        fontWeight: '500',
    },
    doneButton: {
        backgroundColor: '#555', // Darker grey for done button
        padding: 15,
        borderRadius: 5,
        alignItems: 'center',
        marginTop: 10,
    },
    doneButtonText: {
        color: 'white',
        fontWeight: '500',
    },
});

export default PrescriptionReviewScreen;