import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, MEDICATIONS_PATH, PRESCRIPTION_PROCESS_PATH, getBaseUrl } from '../../utils/apiConfig';
import ServerSettingsModal from '../../components/ServerSettingsModal';

const HomeScreen = () => {
  const [medications, setMedications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Tab bar height = 60 + bottom inset
  const TAB_BAR_HEIGHT = 60 + insets.bottom;

  const onAddMedication = () => router.push("/add");

  const onEditMedication = (medication) => {
    if (medication && medication.id) {
      router.push({ pathname: "/update", params: { medicationId: medication.id } });
    }
  };

  const fetchMedications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) { setError("User not authenticated."); setMedications([]); return; }
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      const response = await api.get(MEDICATIONS_PATH, config);
      setMedications(response.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Authentication failed. Please log in again.");
        await AsyncStorage.removeItem('accessToken');
        Alert.alert("Session Expired", "Please log in again.");
        router.replace('/login');
      } else {
        setError(`Failed to fetch medications.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchMedications();
      return () => { };
    }, [])
  );

  const onDeleteMedication = async (medicationId) => {
    Alert.alert("Confirm Deletion", "Are you sure you want to delete this medication?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            setIsLoading(true);
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) { Alert.alert("Authentication Required", "Please log in."); return; }
            await api.delete(`${MEDICATIONS_PATH}${medicationId}/`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            setMedications(prev => prev.filter(med => med.id !== medicationId));
            Alert.alert("Success", "Medication deleted successfully.");
          } catch (error) {
            Alert.alert("Error", "Failed to delete medication. Please try again.");
          } finally {
            setIsLoading(false);
          }
        }
      }
    ]);
  };

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
      aspect: [3, 4],
    });
    if (!result.canceled) uploadImage(result.assets[0].uri);
  };

  const uploadImage = async (imageUri) => {
    setIsLoading(true);
    let filename = imageUri.split('/').pop();
    let match = /\.(\w+)$/.exec(filename);
    let type = match ? `image/${match[1]}` : `image`;
    let formData = new FormData();
    formData.append('image', { uri: imageUri, name: filename, type } as any);

    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) { Alert.alert("Authentication Required", "Please log in."); return; }
      const response = await api.post(PRESCRIPTION_PROCESS_PATH, formData, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      const backendImageUrl = response.data.image_url;
      const fullImageUrl = backendImageUrl?.startsWith('http')
        ? backendImageUrl : `${getBaseUrl()}${backendImageUrl}`;
      router.push({
        pathname: "/prescription",
        params: { prescriptionId: response.data.prescription_id, imageUri: fullImageUrl }
      });
    } catch (error) {
      console.error("Error processing prescription:", error.response?.data || error.message);
      Alert.alert("Error", "Failed to process prescription image.");
      if (error.response?.status === 401 || error.response?.status === 403) {
        router.replace('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getMedicationColor = (name) => {
    const colors = ['#4A90E2', '#50C878', '#FF6B6B', '#FFD700', '#9370DB', '#FF7F50'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getMedicineEmoji = (name) => {
    const emojis = ['💊', '💉', '🩺', '🧪', '🩹', '🧬', '🧫', '🧴', '🩸'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return emojis[Math.abs(hash) % emojis.length];
  };

  const formatTime = (time) => {
    if (!time) return '';
    if (/^\d{2}:\d{2}$/.test(time)) return time;
    if (/^\d{1,2}:\d{2}$/.test(time)) {
      const [h, m] = time.split(':');
      return `${h.padStart(2, '0')}:${m}`;
    }
    return time;
  };

  return (
    // edges={['top']} — SafeAreaView only handles the status bar at top
    // bottom is handled by tab bar itself via insets.bottom
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View>
            <Text style={styles.greetingText}>Hello 👋</Text>
            <Text style={styles.headerTitle}>Your Medications</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              onPress={() => setIsSettingsModalVisible(true)} 
              style={styles.settingsButton}
            >
              <Ionicons name="settings-outline" size={28} color="#555" />
            </TouchableOpacity>
            <View style={styles.avatarContainer}>
              <Ionicons name="person-circle" size={44} color="#4A90E2" />
            </View>
          </View>
        </View>

        {/* Upload Section */}
        <TouchableOpacity style={styles.uploadSection} onPress={pickImage} activeOpacity={0.7}>
          <View style={styles.uploadContent}>
            <View style={styles.uploadIconContainer}>
              <Feather name="upload" size={24} color="#4A90E2" />
            </View>
            <Text style={styles.uploadText}>Upload Your Prescriptions Here</Text>
          </View>
        </TouchableOpacity>

        {/* Loading */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={20} color="#FF6B6B" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Empty State */}
        {!isLoading && !error && medications.length === 0 && (
          <View style={[styles.emptyContainer, { paddingBottom: TAB_BAR_HEIGHT }]}>
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
            // Last item clears FAB + tab bar
            contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 70 }}
          >
            {medications.map((medication) => (
              <View key={medication.id} style={styles.medicationItem}>
                <View style={[styles.medicineIconContainer, { backgroundColor: getMedicationColor(medication.name) }]}>
                  <Text style={styles.medicineIconText}>{getMedicineEmoji(medication.name)}</Text>
                </View>
                <View style={styles.medicationDetails}>
                  <Text style={styles.medicationName}>{medication.name}</Text>
                  <View style={styles.timeContainer}>
                    {(medication.dosages || []).map((dosage, idx) => (
                      <View key={idx} style={styles.timeButton}>
                        <Text style={styles.timeText}>{formatTime(dosage.time)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.editButton} onPress={() => onEditMedication(medication)}>
                    <Feather name="edit-2" size={18} color="#555" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteButton} onPress={() => onDeleteMedication(medication.id)}>
                    <Feather name="trash-2" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <ServerSettingsModal 
          visible={isSettingsModalVisible} 
          onClose={() => setIsSettingsModalVisible(false)} 
        />

        {/* FAB — positioned above the tab bar */}
        <TouchableOpacity
          style={[styles.fab, { bottom: TAB_BAR_HEIGHT + 16 }]}
          onPress={onAddMedication}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsButton: {
    padding: 8,
    marginRight: 4,
  },
  greetingText: { fontSize: 16, color: '#888', marginBottom: 2, fontWeight: '500' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#333' },
  avatarContainer: { backgroundColor: '#F0F7FF', borderRadius: 22, padding: 2 },
  uploadSection: {
    backgroundColor: 'white', borderRadius: 12, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, overflow: 'hidden',
  },
  uploadContent: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  uploadIconContainer: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#F0F7FF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  uploadText: { fontSize: 16, fontWeight: '600', color: '#333', textAlign: 'center' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { marginTop: 10, fontSize: 14, color: '#666' },
  errorContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEEEE',
    padding: 12, borderRadius: 8, marginBottom: 16,
  },
  errorText: { marginLeft: 8, color: '#FF6B6B', fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#666', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center' },
  medicationList: { flex: 1 },
  medicationItem: {
    backgroundColor: 'white', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  medicineIconContainer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  medicineIconText: { color: 'white', fontSize: 20, fontWeight: '700' },
  medicationDetails: { flex: 1, marginLeft: 14 },
  medicationName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 6 },
  timeContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  timeButton: {
    backgroundColor: '#F0F0F0', borderRadius: 16,
    paddingVertical: 4, paddingHorizontal: 10, marginRight: 6, marginBottom: 4,
  },
  timeText: { fontSize: 12, color: '#666', fontWeight: '500' },
  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  editButton: { padding: 8, borderRadius: 20, backgroundColor: '#F5F5F5', marginRight: 8 },
  deleteButton: { padding: 8, borderRadius: 20, backgroundColor: '#FFF0F0' },
  fab: {
    position: 'absolute',
    right: 24,
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