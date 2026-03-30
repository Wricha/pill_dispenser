import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  Image,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from "expo-router";
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, MEDICATIONS_ENDPOINT, TOKEN_REFRESH_ENDPOINT } from '../../utils/apiConfig';

const HomeScreen = () => {
  const [medications, setMedications] = useState([]);
  const [image, setImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  const onAddMedication = () => {
    router.push("/add");
  };

  const onEditMedication = (medication) => {
    if (medication && medication.id) {
      router.push({
        pathname: "/update",
        params: { medicationId: medication.id }
      });
    } else {
      console.error("Cannot edit: Medication data or ID is missing");
    }
  };

  // Function to fetch medications for the logged-in user
  const fetchMedications = async () => {
    setIsLoading(true);
    setError(null);
    let token = null;

    try {
      token = await AsyncStorage.getItem('accessToken');

      if (!token) {
        console.log("No access token found. User might not be logged in.");
        setError("User not authenticated.");
        setMedications([]);
        return;
      }

      const config = {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };

      const response = await axios.get(`${API_BASE_URL}/api/medications/`, config);
      setMedications(response.data);

    } catch (err) {
      console.error("Error fetching medications:", err.response?.data || err.message);
      setError("Failed to fetch medications.");
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        setError("Authentication failed. Please log in again.");
        setMedications([]);
        await AsyncStorage.removeItem('accessToken');
        Alert.alert("Session Expired", "Please log in again.");
        router.replace('/login');
      } else {
        setError(`Failed to fetch medications: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Use useFocusEffect to refetch data when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log("HomeScreen focused, fetching medications...");
      fetchMedications();

      return () => {
        console.log("HomeScreen blurred");
      };
    }, [])
  );

  // Delete medication function
  const onDeleteMedication = async (medicationId) => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this medication?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              const token = await AsyncStorage.getItem('accessToken');
              if (!token) {
                Alert.alert("Authentication Required", "Please log in.");
                setIsLoading(false);
                return;
              }
              const config = { headers: { 'Authorization': `Bearer ${token}` } };

              await axios.delete(`${API_BASE_URL}/api/medications/${medicationId}/`, config);

              setMedications(prevMeds => prevMeds.filter(med => med.id !== medicationId));
              Alert.alert("Success", "Medication deleted successfully.");

            } catch (error) {
              console.error("Error deleting medication:", error.response?.data || error.message);

              if (error.message === "Network Error") {
                Alert.alert("Network Error", "Could not connect to the server. Please check your connection.");
              } else if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                Alert.alert("Authentication Failed", "Your session may have expired. Please log in again.");
              } else if (error.response && error.response.status === 404) {
                Alert.alert("Error", `Medication not found on the server.`);
              } else {
                Alert.alert("Error", "Failed to delete medication. Please try again.");
              }
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Image uploading function
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to upload prescriptions.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      aspect: [3, 4]
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (imageUri) => {
    setIsLoading(true);
    let formData = new FormData();
    let filename = imageUri.split('/').pop();
    let match = /\.(\w+)$/.exec(filename);
    let type = match ? `image/${match[1]}` : `image`;
  
    formData.append('image', {
      uri: imageUri,
      name: filename,
      type: type,
    });
  
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert("Authentication Required", "Please log in.");
        setIsLoading(false);
        return;
      }
      const config = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      };
  
      const response = await axios.post(`${API_BASE_URL}/api/prescriptions/process/`, formData, config);
      
      const backendImageUrl = response.data.image_url;
      const fullImageUrl = backendImageUrl.startsWith('http') 
        ? backendImageUrl 
        : `${API_BASE_URL}${backendImageUrl}`;
    
      if (!fullImageUrl) {
        Alert.alert("Error", "Image URL not received from server after upload.");
        setIsLoading(false);
        return;
      }

      router.push({
        pathname: "/prescription",
        params: { 
          prescriptionId: response.data.prescription_id,
          imageUri: fullImageUrl
        }
      });
      
    } catch (error) {
      console.error("Error processing prescription:", error.response?.data || error.message);
      Alert.alert("Error", "Failed to process prescription image.");
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        Alert.alert("Session Expired", "Please log in again.");
        router.replace('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Get a color based on medication name for the icon
  const getMedicationColor = (name) => {
    const colors = ['#4A90E2', '#50C878', '#FF6B6B', '#FFD700', '#9370DB', '#FF7F50'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Get a medicine emoji based on medication name
  const getMedicineEmoji = (name) => {
    // Array of medicine-related emojis
    const emojis = ['💊', '💉', '🩺', '🧪', '🩹', '🧬', '🧫', '🧴', '🩸'];
    
    // Use the medication name to deterministically select an emoji
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return emojis[Math.abs(hash) % emojis.length];
  };

  // Format time to be more readable
  const formatTime = (time) => {
    if (!time) return '';
    // If time is already in HH:MM format, return it
    if (/^\d{2}:\d{2}$/.test(time)) return time;
    
    // If time is in format like "06:00", ensure it's displayed properly
    if (/^\d{1,2}:\d{2}$/.test(time)) {
      const [hours, minutes] = time.split(':');
      return `${hours.padStart(2, '0')}:${minutes}`;
    }
    
    return time;
  };

  // Render logic
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

      {/* Header Section */}
      <View style={styles.headerContainer}>
        <View>
          <Text style={styles.greetingText}>Hello 👋</Text>
          <Text style={styles.headerTitle}>Your Medications</Text>
        </View>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={44} color="#4A90E2" />
        </View>
      </View>

      {/* Upload Section with Gradient/Soft Color */}
      <TouchableOpacity 
        style={styles.uploadSection} 
        onPress={pickImage}
        activeOpacity={0.7}
      >
        <View style={styles.uploadContent}>
          <View style={styles.uploadIconContainer}>
            <Feather name="upload" size={24} color="#4A90E2" />
          </View>
          <Text style={styles.uploadText}>Upload Your Prescriptions Here</Text>
        </View>
      </TouchableOpacity>

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={20} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Empty State */}
      {!isLoading && !error && medications.length === 0 && (
        <View style={styles.emptyContainer}>
          <Feather name="clipboard" size={50} color="#CCCCCC" />
          <Text style={styles.emptyText}>No medications found</Text>
          <Text style={styles.emptySubtext}>Tap the + button to add your first medication</Text>
        </View>
      )}

      {/* Medications List */}
      {!isLoading && medications.length > 0 && (
        <ScrollView 
          style={styles.medicationList}
          showsVerticalScrollIndicator={false}
        >
          {medications.map((medication) => (
            <View key={medication.id} style={styles.medicationItem}>
              {/* Medication Icon with Emoji instead of first letter */}
              <View style={[styles.medicineIconContainer, { backgroundColor: getMedicationColor(medication.name) }]}> 
                <Text style={styles.medicineIconText}>
                  {getMedicineEmoji(medication.name)}
                </Text>
              </View>
              
              {/* Medication Details */}
              <View style={styles.medicationDetails}>
                <Text style={styles.medicationName}>{medication.name}</Text>
                
                {/* Dosage Times */}
                <View style={styles.timeContainer}>
                  {(medication.dosages || []).map((dosage, idx) => (
                    <View key={idx} style={styles.timeButton}>
                      <Text style={styles.timeText}>{formatTime(dosage.time)}</Text>
                    </View>
                  ))}
                </View>
              </View>
              
              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.editButton} 
                  onPress={() => onEditMedication(medication)}
                >
                  <Feather name="edit-2" size={18} color="#555" />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => onDeleteMedication(medication.id)}
                >
                  <Feather name="trash-2" size={18} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {/* Extra space at bottom for better scrolling */}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* Add Button - Circular Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={onAddMedication}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  header: {
    marginBottom: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  uploadSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  uploadContent: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEEEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    color: '#FF6B6B',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  medicationList: {
    flex: 1,
  },
  medicationItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medicineIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medicineIconText: {
    color: 'white',
    fontSize: 20, // Slightly larger to accommodate emojis
    fontWeight: '700',
  },
  medicationDetails: {
    flex: 1,
    marginLeft: 14,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  timeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  timeButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFF0F0',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  greetingText: {
    fontSize: 16,
    color: '#888',
    marginBottom: 2,
    fontWeight: '500',
  },
  avatarContainer: {
    marginLeft: 10,
    backgroundColor: '#F0F7FF',
    borderRadius: 22,
    padding: 2,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 28,
    backgroundColor: '#4A90E2',
    borderRadius: 32,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
});

export default HomeScreen;