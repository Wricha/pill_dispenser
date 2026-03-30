import React, { useState, useCallback, useEffect } from 'react';
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
import { API_BASE_URL, MEDICATIONS_ENDPOINT, TOKEN_REFRESH_ENDPOINT } from '../../utils/apiConfig';

const MedicationStatusScreen = () => {
  const [medications, setMedications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [todayDate, setTodayDate] = useState('');
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Debug function to check stored tokens
  const debugTokens = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      console.log("=== TOKEN DEBUG INFO ===");
      console.log("Access token exists:", !!accessToken);
      console.log("Refresh token exists:", !!refreshToken);
      
      if (accessToken) {
        // Try to decode JWT payload (basic check)
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          const now = Math.floor(Date.now() / 1000);
          console.log("Access token exp:", payload.exp);
          console.log("Current time:", now);
          console.log("Token expired:", payload.exp < now);
        } catch (e) {
          console.log("Could not decode access token");
        }
      }
      
      console.log("========================");
    } catch (error) {
      console.error("Error checking tokens:", error);
    }
  };

  // Setting up today's date - FIXED: Using useEffect instead of useState
  useEffect(() => {
    const date = new Date();
    setTodayDate(date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric', 
      month: 'long',
      day: 'numeric'
    }));
  }, []);

  // Token refresh function
  const refreshToken = async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      console.log("MedicationStatusScreen: Refresh token exists:", !!refreshToken);
      
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      console.log("MedicationStatusScreen: Attempting to refresh token...");
      console.log("MedicationStatusScreen: Refresh endpoint:", TOKEN_REFRESH_ENDPOINT);
      
      const response = await axios.post(TOKEN_REFRESH_ENDPOINT, {
        refresh: refreshToken
      });

      console.log("MedicationStatusScreen: Refresh response status:", response.status);
      console.log("MedicationStatusScreen: Refresh response data:", response.data);

      if (response.data.access) {
        await AsyncStorage.setItem('accessToken', response.data.access);
        console.log("MedicationStatusScreen: Token refreshed successfully");
        return response.data.access;
      } else {
        throw new Error("No access token in refresh response");
      }
    } catch (error) {
      console.error("MedicationStatusScreen: Token refresh failed:", error.response?.data || error.message);
      console.error("MedicationStatusScreen: Token refresh error status:", error.response?.status);
      
      // Clear stored tokens if refresh fails
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
      throw new Error("Token refresh failed - please log in again");
    }
  };

  // Enhanced API call function with automatic token refresh
  const makeAuthenticatedRequest = async (requestFunction) => {
    let token = await AsyncStorage.getItem('accessToken');
    console.log("MedicationStatusScreen: Access token exists:", !!token);
    
    if (!token) {
      throw new Error("User not authenticated.");
    }

    let config = { headers: { 'Authorization': `Bearer ${token}` } };

    try {
      console.log("MedicationStatusScreen: Making initial API request...");
      return await requestFunction(config);
    } catch (error) {
      console.log("MedicationStatusScreen: Initial request failed with status:", error.response?.status);
      console.log("MedicationStatusScreen: Error response:", error.response?.data);
      
      // If we get a 401 (unauthorized), try to refresh the token
      if (error.response && error.response.status === 401) {
        console.log("MedicationStatusScreen: Access token expired, attempting refresh...");
        
        try {
          const newToken = await refreshToken();
          config = { headers: { 'Authorization': `Bearer ${newToken}` } };
          console.log("MedicationStatusScreen: Retrying request with new token...");
          return await requestFunction(config);
        } catch (refreshError) {
          console.error("MedicationStatusScreen: Token refresh and retry failed:", refreshError.message);
          throw refreshError;
        }
      }
      throw error;
    }
  };

  // Fetching medications data
  const fetchMedications = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Debug tokens before making request
      await debugTokens();
      
      console.log("MedicationStatusScreen: Fetching medications...");
      
      const response = await makeAuthenticatedRequest(async (config) => {
        return await axios.get(MEDICATIONS_ENDPOINT, config);
      });
      
      console.log("MedicationStatusScreen: API Response status:", response.status);
      console.log("MedicationStatusScreen: API Response data:", JSON.stringify(response.data, null, 2));
      
      // Process medications to determine status
      const processedMedications = processMedicationStatus(response.data);
      console.log("MedicationStatusScreen: Processed medications:", JSON.stringify(processedMedications, null, 2));
      setMedications(processedMedications);

    } catch (err) {
      console.error("MedicationStatusScreen: Error fetching medications:", err.response?.data || err.message);
      
      if (err.message.includes("Token refresh failed") || err.message === "User not authenticated.") {
        setError("Please log in again.");
      } else if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        setError("Authentication failed. Please log in again.");
      } else {
        setError("Failed to load medications.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Processing medications to determine status based on MedicationEvent
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
        
        // Check MedicationEvent for today's dispensing
        if (Array.isArray(med.events) && med.events.length > 0) {
          const dispensedToday = med.events.some(event => {
            const eventDate = (event.timestamp || '').split('T')[0];
            // Check if event is from today AND was successful
            return eventDate === todayDate && event.success === true;
          });
          
          if (dispensedToday) {
            status = 'dispensed'; // New status for successfully dispensed
          }
        }
      }
      
      return {
        ...med,
        status
      };
    });
  };

  // Using useFocusEffect to fetch data when screen is focused
  useFocusEffect(
    useCallback(() => {
      // Calling the async function inside the effect
      fetchMedications();
      return () => {
        console.log("MedicationStatusScreen: Screen blurred/unmounted");
      };
    }, [fetchMedications]) // Including fetchMedications in dependencies
  );

  // Auto-refresh every 30 seconds when app is active
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading && !refreshing) {
        fetchMedications();
      }
    }, 30000); // Check every 30 seconds for real-time updates
    
    return () => clearInterval(interval);
  }, [isLoading, refreshing, fetchMedications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMedications();
    setRefreshing(false);
  };

  // NEW: Dispense and automatically record medication
  const dispenseAndRecord = async (medicationId) => {
    setUpdatingStatusId(medicationId);
    
    try {
      console.log(`Dispensing medication ID ${medicationId} physically...`);
      
      await makeAuthenticatedRequest(async (config) => {
        return await axios.post(
          `${API_BASE_URL}/api/dispense-and-record/`,
          { medication_id: medicationId },
          config
        );
      });

      // Refresh medications to show updated status
      await fetchMedications();
      Alert.alert("Success", "Medication dispensed and recorded successfully!");
      
    } catch (error) {
      console.error("Dispensing error:", error.response?.data || error.message);
      
      if (error.message.includes("Token refresh failed") || error.message === "User not authenticated.") {
        Alert.alert("Authentication Required", "Please log in again.");
      } else if (error.response?.data?.detail) {
        Alert.alert("Dispensing Failed", error.response.data.detail);
      } else {
        Alert.alert("Error", "Failed to dispense medication. Please try again.");
      }
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Manual status toggle (for manual recording only)
  const updateMedicationStatus = async (medicationId, currentStatus) => {
    // Only allow manual toggle for not_taken status
    if (currentStatus !== 'not_taken') {
      return;
    }

    setUpdatingStatusId(medicationId);

    try {
      console.log(`Manually recording medication ID ${medicationId} as taken`);
      
      const response = await makeAuthenticatedRequest(async (config) => {
        return await axios.post(
          `${API_BASE_URL}/api/medication-events/`, 
          { 
            medication: medicationId,
            success: true,
            amount: 1, // You might need to get the correct amount from the medication
          }, 
          config
        );
      });

      if (response.status === 201 || response.status === 200) {
        // Refresh medications to show updated status
        await fetchMedications();
      } else {
        throw new Error(`Server responded with status ${response.status}`);
      }

    } catch (error) {
      console.error("Error updating medication status:", error.response?.data || error.message);
      
      if (error.message.includes("Token refresh failed") || error.message === "User not authenticated.") {
        Alert.alert("Authentication Required", "Please log in again.");
      } else {
        Alert.alert("Error", "Failed to update medication status. Please try again.");
      }
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const renderStatusIcon = (status) => {
    switch (status) {
      case 'dispensed':
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
      case 'dispensed':
        return 'Dispensed';
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
      <View style={styles.medicationCard}>
        {/* Main medication info section */}
        <TouchableOpacity 
          style={styles.infoSection}
          onPress={() => item.status === 'not_taken' && updateMedicationStatus(item.id, item.status)}
          disabled={isUpdating || item.status !== 'not_taken'}
        >
          <Text style={styles.medicationName}>{item.name}</Text>
          <Text style={styles.medicationDetails}>
            {item.dosages && item.dosages.length > 0 ? `${item.dosages[0].amount || ''} ` : ''}
            {item.schedules && item.schedules.length > 0 ? 
              `· ${item.schedules[0].time || 'Time not set'}` : ''}
          </Text>
          <Text style={styles.slotInfo}>Dispenser Slot: {item.dispenser_slot}</Text>
        </TouchableOpacity>

        {/* Action section with status and dispense button */}
        <View style={styles.actionSection}>
          {/* Status display */}
          <View style={styles.statusSection}>
            {isUpdating ? (
              <ActivityIndicator size="small" color="#CC7755" />
            ) : (
              renderStatusIcon(item.status)
            )}
            <Text style={[
              styles.statusText,
              item.status === 'dispensed' && styles.dispensedText,
              item.status === 'not_taken' && styles.notTakenText,
              item.status === 'not_applicable' && styles.notApplicableText,
            ]}>
              {getStatusText(item.status)}
            </Text>
          </View>

          {/* Dispense button for scheduled medications that haven't been taken */}
          {item.status === 'not_taken' && (
            <TouchableOpacity 
              style={styles.dispenseButton}
              onPress={() => dispenseAndRecord(item.id)}
              disabled={isUpdating}
            >
              <Ionicons name="medical" size={16} color="#ffffff" />
              <Text style={styles.dispenseButtonText}>Dispense</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
  actionSection: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  statusSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  dispensedText: {
    color: '#4CAF50',
  },
  notTakenText: {
    color: '#F44336',
  },
  notApplicableText: {
    color: '#9E9E9E',
  },
  dispenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CC7755',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  dispenseButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
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