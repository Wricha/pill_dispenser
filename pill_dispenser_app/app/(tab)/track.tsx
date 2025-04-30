import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API configuration - Use the same API_BASE_URL as your RefillScreen for consistency
const API_BASE_URL = "http://192.168.1.67:8000";
const MEDICATIONS_ENDPOINT = `${API_BASE_URL}/api/medications/`;

const MedicationStatusScreen = () => {
  const [medications, setMedications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [todayDate, setTodayDate] = useState('');
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Set up today's date
  useState(() => {
    const date = new Date();
    setTodayDate(date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));
  }, []);

  // Fetch medications data
  const fetchMedications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    let token = null;

    try {
      token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        throw new Error("User not authenticated.");
      }

      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      console.log("MedicationStatusScreen: Fetching medications...");
      const response = await axios.get(MEDICATIONS_ENDPOINT, config);
      
      // Process medications to determine status
      const processedMedications = processMedicationStatus(response.data);
      setMedications(processedMedications);

    } catch (err) {
      console.error("MedicationStatusScreen: Error fetching medications:", err.response?.data || err.message);
      setError("Failed to load medications.");
      
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        setError("Authentication failed. Please log in again.");
        // Optional: Clear token and redirect
        // await AsyncStorage.removeItem('accessToken');
        // router.replace('/login');
      } else if (err.message === "User not authenticated.") {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Process medications to determine status (taken/not taken)
  const processMedicationStatus = (medicationsData) => {
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
    const todayDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    return medicationsData.map(med => {
      // Check if medication is scheduled for today
      const isScheduledToday = Array.isArray(med.selected_days) && 
        med.selected_days.some(day => day.toLowerCase().includes(dayOfWeek));
      
      let status = 'not_applicable';
      
      if (isScheduledToday) {
        // Default to not taken
        status = 'not_taken';
        
        // Check if taken today
        if (Array.isArray(med.events) && med.events.length > 0) {
          const takenToday = med.events.some(event => {
            const eventDate = (event.timestamp || '').split('T')[0];
            return eventDate === todayDate && event.success;
          });
          
          if (takenToday) {
            status = 'taken';
          }
        }
      }
      
      return {
        ...med,
        status
      };
    });
  };

  // Use useFocusEffect to fetch data when screen is focused
  useFocusEffect(fetchMedications);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMedications();
    setRefreshing(false);
  };

  // Update medication status
  const updateMedicationStatus = async (medicationId, currentStatus) => {
    setUpdatingStatusId(medicationId);
    let token = null;

    try {
      token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert("Authentication Required", "Please log in.");
        setUpdatingStatusId(null);
        return;
      }

      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      const newStatus = currentStatus === 'taken' ? 'not_taken' : 'taken';
      
      // In a real app, you would update the appropriate endpoint
      // This is an example - you may need to adjust based on your API
      const data = { 
        event_status: newStatus === 'taken' ? true : false,
        // You might need additional fields like timestamp, etc.
      };

      console.log(`Updating status for medication ID ${medicationId} to ${newStatus}`);
      
      // Create an event or update status - adjust URL based on your API
      const response = await axios.post(
        `${API_BASE_URL}/api/medication-events/`, 
        { 
          medication: medicationId,
          success: newStatus === 'taken',
          amount: 1, // You might need to get the correct amount from the medication
        }, 
        config
      );

      if (response.status === 201 || response.status === 200) {
        const success = response.data.success;
        const updatedStatus = success ? 'taken' : 'not_taken';
        // Update local state
        setMedications(currentMeds =>
          currentMeds.map(med =>
            med.id === medicationId
              ? { ...med, status: updatedStatus }
              : med
          )
        );
      } else {
        throw new Error(`Server responded with status ${response.status}`);
      }

    } catch (error) {
      console.error("Error updating medication status:", error.response?.data || error.message);
      
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        Alert.alert("Authentication Failed", "Your session may have expired or you lack permission.");
      } else {
        Alert.alert("Error", "Failed to update medication status. Please try again.");
      }
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const renderStatusIcon = (status) => {
    switch (status) {
      case 'taken':
        return <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />;
      case 'not_taken':
        return <Ionicons name="close-circle" size={24} color="#F44336" />;
      case 'not_applicable':
        return <Ionicons name="remove-circle-outline" size={24} color="#9E9E9E" />;
      default:
        return <Ionicons name="help-circle" size={24} color="#9E9E9E" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'taken':
        return 'Taken';
      case 'not_taken':
        return 'Not Taken';
      case 'not_applicable':
        return 'Not Scheduled Today';
      default:
        return 'Unknown Status';
    }
  };

  const renderItem = ({ item }) => {
    const isUpdating = updatingStatusId === item.id;
    
    return (
      <TouchableOpacity 
        style={styles.medicationCard}
        onPress={() => item.status !== 'not_applicable' && updateMedicationStatus(item.id, item.status)}
        disabled={isUpdating || item.status === 'not_applicable'}
      >
        <View style={styles.infoSection}>
          <Text style={styles.medicationName}>{item.name}</Text>
          <Text style={styles.medicationDetails}>
            {/* Display dosage info if available */}
            {item.dosages && item.dosages.length > 0 ? `${item.dosages[0].amount || ''} ` : ''}
            
            {/* Try to get time if available */}
            {item.schedules && item.schedules.length > 0 ? 
              `· ${item.schedules[0].time || 'Time not set'}` : ''}
          </Text>
          <Text style={styles.slotInfo}>Dispenser Slot: {item.dispenser_slot}</Text>
        </View>
        <View style={styles.statusSection}>
          {isUpdating ? (
            <ActivityIndicator size="small" color="#CC7755" />
          ) : (
            renderStatusIcon(item.status)
          )}
          <Text style={[
            styles.statusText,
            item.status === 'taken' && styles.takenText,
            item.status === 'not_taken' && styles.notTakenText,
            item.status === 'not_applicable' && styles.notApplicableText,
          ]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Medication Status</Text>
        <Text style={styles.dateText}>{todayDate}</Text>
      </View>
      
      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#CC7755" />
        </View>
      ) : (
        <FlatList
          data={medications}
          renderItem={renderItem}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#CC7755']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {error ? error : 'No medications scheduled.'}
              </Text>
              {error && (
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={fetchMedications}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  dateText: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  medicationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  infoSection: {
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  medicationDetails: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  slotInfo: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 4,
  },
  statusSection: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  statusText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  takenText: {
    color: '#4CAF50',
  },
  notTakenText: {
    color: '#F44336',
  },
  notApplicableText: {
    color: '#9E9E9E',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#CC7755',
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '500',
  },
});

export default MedicationStatusScreen;