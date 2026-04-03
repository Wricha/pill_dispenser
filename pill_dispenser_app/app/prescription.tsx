import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api, MEDICATIONS_PATH } from '../utils/apiConfig';

const PrescriptionReviewScreen = () => {
    const params = useLocalSearchParams();
    const { prescriptionId, imageUri } = params;
    const router = useRouter();
    const [detectedMedicines, setDetectedMedicines] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [imageWidth, setImageWidth] = useState(0);
    const [imageHeight, setImageHeight] = useState(0);
    const [savedMedicationNames, setSavedMedicationNames] = useState(new Set());
    const [renderedImageWidth, setRenderedImageWidth] = useState(0);
    const [renderedImageHeight, setRenderedImageHeight] = useState(0);

    // ── Frequency → Days mapper ───────────────────────────────────────────────
    const mapFrequencyToDays = (frequency = "") => {
        const allDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        const f = (frequency || "").toLowerCase().trim();

        if (!f) return allDays; // default to every day if unknown

        if (
            f.includes("every day") ||
            f.includes("daily") ||
            f.includes("once a day") ||
            f.includes("once daily") ||
            f.includes("od") ||
            f.includes("1 time") ||
            f.includes("one time")
        ) return allDays;

        if (
            f.includes("twice") ||
            f.includes("two times") ||
            f.includes("2 times") ||
            f.includes("bid") ||
            f.includes("bd") ||
            f.includes("every 12")
        ) return allDays; // every day, twice — dosage count handled separately

        if (
            f.includes("three times") ||
            f.includes("3 times") ||
            f.includes("thrice") ||
            f.includes("tid") ||
            f.includes("tds") ||
            f.includes("every 8")
        ) return allDays;

        if (
            f.includes("four times") ||
            f.includes("4 times") ||
            f.includes("qid") ||
            f.includes("every 6")
        ) return allDays;

        if (f.includes("weekday") || f.includes("week day")) return weekdays;

        if (f.includes("weekly") || f.includes("once a week")) return ["Monday"]; // just one day

        // Check for specific day mentions
        const dayMap = {
            sunday: "Sunday", monday: "Monday", tuesday: "Tuesday",
            wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday",
        };
        const mentionedDays = Object.entries(dayMap)
            .filter(([key]) => f.includes(key))
            .map(([, val]) => val);

        return mentionedDays.length > 0 ? mentionedDays : allDays;
    };

    // ── Navigation — now passes frequency-derived days too ───────────────────
    const navigateToMedicationForm = (medicine) => {
        const nameToPass = typeof medicine.name === 'string' ? medicine.name : '';
        if (!nameToPass) {
            Alert.alert("Cannot Add", "Medicine name is missing.");
            return;
        }

        const mappedDays = mapFrequencyToDays(medicine.frequency);

        console.log("Navigating with name:", nameToPass);
        console.log("Frequency from prescription:", medicine.frequency);
        console.log("Mapped days:", mappedDays);

        router.push({
            pathname: "/addtomedication",
            params: {
                prefilledName: nameToPass,
                prefilledFrequency: medicine.frequency || '',        // raw text e.g. "every day"
                prefilledDays: JSON.stringify(mappedDays),           // e.g. ["Sunday","Monday",...]
            }
        });
    };

    // ── Fetch detected medicines ──────────────────────────────────────────────
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
            const response = await api.get(
                `/api/prescriptions/${prescriptionId}/medicines/`,
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

    // ── Fetch user's already-saved medications ────────────────────────────────
    const fetchUserMedications = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) return;
            const config = { headers: { 'Authorization': `Bearer ${token}` } };
            const response = await api.get(MEDICATIONS_PATH, config);
            if (Array.isArray(response.data)) {
                setSavedMedicationNames(new Set(response.data.map(med => med.name)));
            }
        } catch (error) {
            console.error("Error fetching user medications:", error);
        }
    }, []);

    useEffect(() => {
        fetchDetectedMedicines();
        if (!params.imageUri) {
            setIsLoading(false);
            return;
        }
        fetch(params.imageUri)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                Image.getSize(
                    params.imageUri,
                    (width, height) => { setImageWidth(width); setImageHeight(height); },
                    (error) => console.error("Image.getSize error:", error)
                );
            })
            .catch(error => {
                console.error("Image fetch failed:", error);
                Alert.alert("Image Error", `Could not access image: ${error.message}`);
            });
    }, [params.prescriptionId, params.imageUri]);

    useFocusEffect(
        useCallback(() => {
            fetchUserMedications();
            return () => { };
        }, [fetchUserMedications])
    );

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Loading detected medicines...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Review Detected Medications</Text>

            <View style={styles.imageContainer}>
                {imageUri ? (
                    <Image
                        source={{ uri: imageUri }}
                        style={styles.image}
                        resizeMode="contain"
                        onLayout={(event) => {
                            const { width, height } = event.nativeEvent.layout;
                            setRenderedImageWidth(width);
                            setRenderedImageHeight(height);
                        }}
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

                {/* Bounding boxes — only render if bbox values are non-zero */}
                {imageWidth > 0 && imageHeight > 0 && detectedMedicines.map((medicine) => (
                    medicine.bbox_x > 0 && medicine.bbox_y > 0 ? (
                        <View
                            key={medicine.id}
                            style={[
                                styles.boundingBox,
                                {
                                    left: (medicine.bbox_x / imageWidth) * renderedImageWidth,
                                    top: (medicine.bbox_y / imageHeight) * renderedImageHeight,
                                    width: (medicine.bbox_width / imageWidth) * renderedImageWidth,
                                    height: (medicine.bbox_height / imageHeight) * renderedImageHeight,
                                },
                            ]}
                        />
                    ) : null
                ))}
            </View>

            <ScrollView style={styles.medicineList}>
                {detectedMedicines.length === 0 && !isLoading && (
                    <Text style={styles.noMedicinesText}>No medicines detected in this prescription.</Text>
                )}

                {detectedMedicines.map((medicine) => {
                    const isAdded = savedMedicationNames.has(medicine.name);
                    return (
                        <View key={medicine.id} style={styles.medicineItem}>
                            <View style={styles.medicineDetails}>
                                <Text style={styles.medicineName}>{medicine.name || 'Unnamed Medicine'}</Text>
                                <Text style={styles.medicineFrequency}>
                                    Frequency: {medicine.frequency || 'Not specified'}
                                </Text>

                                {isAdded ? (
                                    <View style={styles.addedIndicator}>
                                        <Feather name="check-square" size={16} color="green" />
                                        <Text style={styles.addedText}>Added to My Med List</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.addButton}
                                        onPress={() => navigateToMedicationForm(medicine)}  // pass full medicine object
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

            <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
                <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    imageContainer: {
        position: 'relative',
        width: 300,
        height: 400,
        alignSelf: 'center',
        marginBottom: 20,
        backgroundColor: '#eee',
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: { width: '100%', height: '100%' },
    noImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
    boundingBox: {
        position: 'absolute',
        borderWidth: 2,
        borderColor: '#4a90e2',
        backgroundColor: 'rgba(74, 144, 226, 0.1)',
    },
    medicineList: { flex: 1, marginBottom: 10 },
    noMedicinesText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#666' },
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
    medicineDetails: { flex: 1 },
    medicineName: { fontSize: 16, fontWeight: '500', marginBottom: 5 },
    medicineFrequency: { fontSize: 14, color: '#666', marginBottom: 10 },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: 5,
        paddingHorizontal: 8,
        marginTop: 5,
    },
    buttonText: { marginLeft: 5, fontSize: 14 },
    addedIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: 5,
        paddingHorizontal: 8,
        marginTop: 5,
    },
    addedText: { marginLeft: 5, fontSize: 14, color: 'green', fontWeight: '500' },
    doneButton: {
        backgroundColor: '#555',
        padding: 15,
        borderRadius: 5,
        alignItems: 'center',
        marginTop: 10,
    },
    doneButtonText: { color: 'white', fontWeight: '500' },
});

export default PrescriptionReviewScreen;