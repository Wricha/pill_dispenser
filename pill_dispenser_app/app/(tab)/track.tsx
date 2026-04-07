import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, MEDICATIONS_PATH, TOKEN_REFRESH_PATH, getBaseUrl } from '../../utils/apiConfig';

const MedicationStatusScreen = () => {
  const [medications, setMedications] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayDate, setTodayDate] = useState('');
  const [updatingStatusId, setUpdatingStatusId] = useState<any>(null);
  const insets = useSafeAreaInsets();

  const TAB_BAR_HEIGHT = 60 + insets.bottom;

  useEffect(() => {
    const date = new Date();
    setTodayDate(date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));
  }, []);

  const debugTokens = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      console.log("Access token exists:", !!accessToken);
      console.log("Refresh token exists:", !!refreshToken);
      if (accessToken) {
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          const now = Math.floor(Date.now() / 1000);
          console.log("Token expired:", payload.exp < now);
        } catch (e) {
          console.log("Could not decode access token");
        }
      }
    } catch (error) {
      console.error("Error checking tokens:", error);
    }
  };

  const refreshToken = async () => {
    try {
      const storedRefreshToken = await AsyncStorage.getItem('refreshToken');
      if (!storedRefreshToken) throw new Error("No refresh token available");
      const response = await api.post(TOKEN_REFRESH_PATH, { refresh: storedRefreshToken });
      if (response.data.access) {
        await AsyncStorage.setItem('accessToken', response.data.access);
        return response.data.access;
      } else {
        throw new Error("No access token in refresh response");
      }
    } catch (error) {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
      throw new Error("Token refresh failed - please log in again");
    }
  };

  const makeAuthenticatedRequest = async (requestFunction: any) => {
    let token = await AsyncStorage.getItem('accessToken');
    if (!token) throw new Error("User not authenticated.");
    let config = { headers: { 'Authorization': `Bearer ${token}` } };
    try {
      return await requestFunction(config);
    } catch (error: any) {
      if (error.response && error.response.status === 401) {
        const newToken = await refreshToken();
        config = { headers: { 'Authorization': `Bearer ${newToken}` } };
        return await requestFunction(config);
      }
      throw error;
    }
  };

  const processMedicationStatus = (medicationsData: any) => {
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
    const todayDateStr = today.toISOString().split('T')[0];

    return medicationsData.map((med: any) => {
      const isScheduledToday = Array.isArray(med.selected_days) &&
        med.selected_days.some((day: any) => day.toLowerCase().includes(dayOfWeek));

      let status = 'not_applicable';

      if (isScheduledToday) {
        status = 'not_taken';
        if (Array.isArray(med.status_today) && med.status_today.length > 0) {
          status = 'dispensed';
        }
      }

      return { ...med, status };
    });
  };

  const fetchMedications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await debugTokens();
      const response = await makeAuthenticatedRequest(async (config: any) => {
        return await api.get(MEDICATIONS_PATH, config);
      });
      setMedications(processMedicationStatus(response.data));
    } catch (err: any) {
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

  useFocusEffect(
    useCallback(() => {
      fetchMedications();
      return () => { };
    }, [fetchMedications])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading && !refreshing) fetchMedications();
    }, 30000);
    return () => clearInterval(interval);
  }, [isLoading, refreshing, fetchMedications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMedications();
    setRefreshing(false);
  };

  const dispenseAndRecord = async (medicationId: any) => {
    setUpdatingStatusId(medicationId);
    try {
      await makeAuthenticatedRequest(async (config: any) => {
        return await api.post(
          '/api/dispense-and-record/',
          { medication_id: medicationId },
          config
        );
      });
      await fetchMedications();
      Alert.alert("Success", "Medication dispensed and recorded successfully!");
    } catch (error: any) {
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

  const updateMedicationStatus = async (medicationId: any, currentStatus: any) => {
    if (currentStatus !== 'not_taken') return;
    setUpdatingStatusId(medicationId);
    try {
      const response = await makeAuthenticatedRequest(async (config: any) => {
        return await api.post(
          '/api/medication-events/',
          { medication: medicationId, success: true, amount: 1 },
          config
        );
      });
      if (response.status === 201 || response.status === 200) {
        await fetchMedications();
      }
    } catch (error: any) {
      Alert.alert("Error", "Failed to update medication status. Please try again.");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const renderStatusIcon = (status: any) => {
    switch (status) {
      case 'dispensed':
        return <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />;
      case 'not_taken':
        return <Ionicons name="close-circle" size={28} color="#F44336" />;
      case 'not_applicable':
        return <Ionicons name="remove-circle-outline" size={28} color="#9E9E9E" />;
      default:
        return <Ionicons name="help-circle" size={28} color="#9E9E9E" />;
    }
  };

  const getStatusText = (status: any) => {
    switch (status) {
      case 'dispensed': return 'Dispensed';
      case 'not_taken': return 'Not Taken';
      case 'not_applicable': return 'Not Scheduled Today';
      default: return 'Unknown';
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isUpdating = updatingStatusId === item.id;
    return (
      <View style={styles.medicationCard}>
        <TouchableOpacity
          style={styles.infoSection}
          onPress={() => item.status === 'not_taken' && updateMedicationStatus(item.id, item.status)}
          disabled={isUpdating || item.status !== 'not_taken'}
        >
          <Text style={styles.medicationName}>{item.name}</Text>
          <Text style={styles.medicationDetails}>
            {item.dosages && item.dosages.length > 0 ? `${item.dosages[0].amount || ''}` : ''}
            {item.dosages && item.dosages.length > 0 && item.dosages[0].time
              ? `  ·  ${item.dosages[0].time}` : ''}
          </Text>
          <Text style={styles.slotInfo}>Dispenser Slot: {item.dispenser_slot}</Text>
        </TouchableOpacity>

        <View style={styles.actionSection}>
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

          {item.status === 'not_taken' && (
            <TouchableOpacity
              style={[styles.dispenseButton, isUpdating && { opacity: 0.6 }]}
              onPress={() => dispenseAndRecord(item.id)}
              disabled={isUpdating}
            >
              <Ionicons name="medical" size={14} color="#ffffff" />
              <Text style={styles.dispenseButtonText}>Dispense</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    // edges={['top']} — only handle status bar; tab bar handles bottom
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Medication Status</Text>
        <Text style={styles.dateText}>{todayDate}</Text>
      </View>

      {/* Content */}
      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#CC7755" />
        </View>
      ) : (
        <FlatList
          data={medications}
          renderItem={renderItem}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: TAB_BAR_HEIGHT + 16 }   // clears tab bar
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#CC7755']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#CCCCCC" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>
                {error ? error : 'No medications scheduled for today.'}
              </Text>
              {error && (
                <TouchableOpacity style={styles.retryButton} onPress={fetchMedications}>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  },
  medicationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  infoSection: {
    flex: 1,
    paddingRight: 8,
  },
  medicationName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  medicationDetails: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  slotInfo: {
    fontSize: 12,
    color: '#BDBDBD',
  },
  actionSection: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  statusSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
  dispensedText: { color: '#4CAF50' },
  notTakenText: { color: '#F44336' },
  notApplicableText: { color: '#9E9E9E' },
  dispenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CC7755',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  dispenseButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyContainer: {
    paddingTop: 60,
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
    paddingHorizontal: 20,
    backgroundColor: '#CC7755',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default MedicationStatusScreen;