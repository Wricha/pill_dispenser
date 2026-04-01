import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from "expo-router";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, MEDICATIONS_ENDPOINT } from '../../utils/apiConfig';

const RefillScreen = () => {
  const [medications, setMedications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [updatingStockId, setUpdatingStockId] = useState(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const TAB_BAR_HEIGHT = 60 + insets.bottom;

  const fetchMedications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) throw new Error("User not authenticated.");
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      const response = await axios.get(MEDICATIONS_ENDPOINT, config);
      setMedications(response.data);
    } catch (err) {
      console.error("RefillScreen error:", err.response?.data || err.message);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Authentication failed. Please log in again.");
      } else if (err.message === "User not authenticated.") {
        setError(err.message);
      } else {
        setError("Failed to load medication stock levels.");
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

  const updateMedicationStock = async (medicationId, newStock) => {
    if (newStock < 0) return;
    setUpdatingStockId(medicationId);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) { Alert.alert("Authentication Required", "Please log in."); return; }
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      const response = await axios.patch(`${MEDICATIONS_ENDPOINT}${medicationId}/`, { stock: newStock }, config);
      if (response.status === 200) {
        setMedications(prev =>
          prev.map(med => med.id === medicationId ? { ...med, stock: newStock } : med)
        );
      } else {
        throw new Error(`Server responded with status ${response.status}`);
      }
    } catch (error) {
      console.error("Error updating stock:", error.response?.data || error.message);
      if (error.response?.status === 401 || error.response?.status === 403) {
        Alert.alert("Authentication Failed", "Your session may have expired.");
      } else if (error.response?.status === 404) {
        Alert.alert("Error", "Medication not found.");
        setMedications(prev => prev.filter(med => med.id !== medicationId));
      } else {
        Alert.alert("Error", "Failed to update stock. Please try again.");
      }
    } finally {
      setUpdatingStockId(null);
    }
  };

  const getStockColor = (stock) => {
    if (stock === 0) return '#F44336';
    if (stock <= 5) return '#FF9800';
    return '#4CAF50';
  };

  return (
    // edges={['top']} — pushes content below status bar; tab bar handles bottom
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Refill Stock</Text>
        <Text style={styles.headerSubtitle}>Manage your medication quantities</Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.listContainer,
          { paddingBottom: TAB_BAR_HEIGHT + 16 }   // clears tab bar
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading && (
          <ActivityIndicator size="large" color="#CC7755" style={{ marginTop: 40 }} />
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchMedications}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !error && medications.length === 0 && (
          <Text style={styles.emptyText}>No medications found.</Text>
        )}

        {!isLoading && medications.map((medication) => {
          const isUpdating = updatingStockId === medication.id;
          const stockColor = getStockColor(medication.stock);

          return (
            <View key={medication.id} style={styles.medicationItem}>
              <View style={styles.medicineRow}>
                {/* Left: name + stock indicator */}
                <View style={styles.nameSection}>
                  <Text style={styles.medicineName}>{medication.name}</Text>
                  <View style={styles.stockBadge}>
                    <View style={[styles.stockDot, { backgroundColor: stockColor }]} />
                    <Text style={[styles.stockLabel, { color: stockColor }]}>
                      {medication.stock === 0
                        ? 'Out of stock'
                        : medication.stock <= 5
                          ? 'Low stock'
                          : 'In stock'}
                    </Text>
                  </View>
                </View>

                {/* Right: stock controls */}
                <View style={styles.stockContainer}>
                  <TouchableOpacity
                    style={[styles.stockButton, (isUpdating || medication.stock === 0) && styles.stockButtonDisabled]}
                    onPress={() => updateMedicationStock(medication.id, Math.max(0, medication.stock - 1))}
                    disabled={isUpdating || medication.stock === 0}
                  >
                    <Text style={styles.stockButtonText}>−</Text>
                  </TouchableOpacity>

                  <View style={styles.stockTextContainer}>
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="#CC7755" />
                    ) : (
                      <Text style={[styles.stockText, { color: stockColor }]}>
                        {medication.stock}
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.stockButton, isUpdating && styles.stockButtonDisabled]}
                    onPress={() => updateMedicationStock(medication.id, medication.stock + 1)}
                    disabled={isUpdating}
                  >
                    <Text style={styles.stockButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
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
  headerSubtitle: {
    fontSize: 13,
    color: '#9E9E9E',
    marginTop: 2,
  },
  container: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  errorContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  errorText: {
    color: '#F44336',
    textAlign: 'center',
    fontSize: 15,
    marginBottom: 12,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#CC7755',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 60,
    color: '#9E9E9E',
    fontSize: 16,
  },
  medicationItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  medicineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  nameSection: {
    flex: 1,
    marginRight: 12,
  },
  medicineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  stockLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockButton: {
    backgroundColor: '#CC7755',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
  },
  stockButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  stockButtonText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  stockTextContainer: {
    minWidth: 44,
    height: 34,
    marginHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default RefillScreen;