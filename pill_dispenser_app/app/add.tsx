"use client"

import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { api, MEDICATIONS_PATH } from '../utils/apiConfig'
import AsyncStorage from "@react-native-async-storage/async-storage"
import DateTimePicker from "@react-native-community/datetimepicker"

const parseTimeString = (timeString: string = "09:00"): Date => {
  const [hours, minutes] = timeString.split(":").map(Number)
  const date = new Date()
  date.setHours(hours || 9)
  date.setMinutes(minutes || 0)
  date.setSeconds(0)
  date.setMilliseconds(0)
  return date
}

const formatTime = (date: Date): string => {
  if (!date) return "00:00"
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

const MedicationDetailScreen = () => {
  const router = useRouter()
  const insets = useSafeAreaInsets()


  const [medicineName, setMedicineName] = useState("")
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [dosages, setDosages] = useState<any[]>([{ id: Date.now(), amount: 1, time: "09:00" }])
  const [stock, setStock] = useState(10)
  const [reminder, setReminder] = useState(5)
  const [isLoading, setIsLoading] = useState(false)
  const [slotNumber, setSlotNumber] = useState(1)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerDate, setPickerDate] = useState(new Date())
  const [editingDosageIndex, setEditingDosageIndex] = useState(-1)

  const onSave = async () => {
    setIsLoading(true)
    let token = null
    let userId = null
    try {
      token = await AsyncStorage.getItem("accessToken")
      const storedUserId = await AsyncStorage.getItem("userId")
      userId = storedUserId ? Number.parseInt(storedUserId, 10) : null

      if (!token || !userId) {
        Alert.alert("Authentication Error", "Could not find user session. Please log in again.")
        router.replace("/login")
        setIsLoading(false)
        return
      }
    } catch (e: any) {
      Alert.alert("Error", "Failed to retrieve user session.")
      setIsLoading(false)
      return
    }

    const data = {
      name: medicineName,
      selected_days: selectedDays,
      dosages: dosages.map((d: any) => ({ amount: d.amount, time: d.time })),
      stock,
      reminder,
      user: userId,
      dispenser_slot: slotNumber,
    }

    if (!data.name) { Alert.alert("Validation Error", "Please enter a medicine name."); setIsLoading(false); return }
    if (data.selected_days.length === 0) { Alert.alert("Validation Error", "Please select at least one day."); setIsLoading(false); return }
    if (data.dosages.length === 0) { Alert.alert("Validation Error", "Please add at least one dosage time."); setIsLoading(false); return }

    const config = {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    }

    try {
      const response = await api.get(MEDICATIONS_PATH, config)
      const existingSlot = response.data.find((med: any) => med.dispenser_slot === slotNumber)
      if (existingSlot) {
        Alert.alert("Validation Error", "This slot is already assigned. Please select a different slot.")
        setIsLoading(false)
        return
      }
      await saveMedication(data, config)
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        Alert.alert("Authentication Failed", "Your session may have expired.")
        router.replace("/login")
      } else {
        Alert.alert("Error", "Failed to check slot availability. Please try again.")
      }
      setIsLoading(false)
    }
  }

  const saveMedication = async (data: any, config: any) => {
    try {
      const response = await api.post(MEDICATIONS_PATH, data, config)
      if (response.status === 201) {
        Alert.alert("Success", "Medication saved successfully!")
        router.canGoBack() ? router.back() : router.replace("/(tab)")
      } else {
        Alert.alert("Save Failed", `Server responded with status: ${response.status}`)
      }
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        Alert.alert("Authentication Failed", "Your session may have expired.")
        router.replace("/login")
      } else if (error.response?.data) {
        const errorMessages = Object.entries(error.response.data)
          .map(([field, messages]: [string, any]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
          .join("\n")
        Alert.alert("Save Failed", errorMessages || "Unknown server error")
      } else {
        Alert.alert("Network Error", "Could not connect to the server.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const toggleDay = (day: string) => {
    setSelectedDays((prev: string[]) =>
      prev.includes(day) ? prev.filter((d: string) => d !== day) : [...prev, day]
    )
  }

  const adjustValue = (setter: any, currentValue: number, increment: number, min: number = 0, max: number = Number.POSITIVE_INFINITY) => {
    setter(Math.min(max, Math.max(min, currentValue + increment)))
  }

  const addDosageRow = () => setDosages([...dosages, { id: Date.now(), amount: 1, time: "08:00" }])

  const removeDosageRow = (idToRemove: number) => {
    if (dosages.length <= 1) { Alert.alert("Cannot Remove", "You must have at least one dosage time."); return }
    setDosages(dosages.filter((d: any) => d.id !== idToRemove))
  }

  const openTimePicker = (index: number) => {
    if (isLoading) return
    setEditingDosageIndex(index)
    setPickerDate(parseTimeString(dosages[index]?.time || "09:00"))
    setShowPicker(true)
  }

  const onTimeChange = (event: any, selectedDate: any) => {
    if (Platform.OS === "android") setShowPicker(false)
    if (event.type === "set" && selectedDate) {
      if (editingDosageIndex >= 0) {
        const newDosages = [...dosages]
        newDosages[editingDosageIndex].time = formatTime(selectedDate)
        setDosages(newDosages)
      }
    } else {
      if (Platform.OS === "ios") setShowPicker(false)
    }
  }

  const ALL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  return (
    // edges={['top']} — handles status bar only; tab bar handles bottom
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Medicine Name */}
        <View style={styles.medicationName}>
          <TextInput
            placeholder="Medicine Name"
            placeholderTextColor="rgb(150,150,150)"
            style={styles.nameInput}
            value={medicineName}
            onChangeText={setMedicineName}
          />
        </View>

        {/* Frequency */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Frequency</Text>

          {/* Quick select buttons */}
          <View style={styles.quickSelectRow}>
            <TouchableOpacity style={styles.quickSelectButton} onPress={() => setSelectedDays([...ALL_DAYS])}>
              <Text style={styles.quickSelectText}>Every Day</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickSelectButton} onPress={() => setSelectedDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])}>
              <Text style={styles.quickSelectText}>Weekdays</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickSelectButton, { backgroundColor: '#eee' }]} onPress={() => setSelectedDays([])}>
              <Text style={[styles.quickSelectText, { color: '#666' }]}>Clear</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.daysContainer}>
            <View style={styles.daysRow}>
              {["Sunday", "Monday", "Tuesday", "Wednesday"].map(day => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayButton, selectedDays.includes(day) && styles.selectedDay]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[styles.dayText, selectedDays.includes(day) && styles.selectedDayText]}>{day}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.daysRow}>
              {["Thursday", "Friday", "Saturday"].map(day => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayButton, selectedDays.includes(day) && styles.selectedDay]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[styles.dayText, selectedDays.includes(day) && styles.selectedDayText]}>{day}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Schedule */}
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
            <View style={{ width: 30 }} />
          </View>

          {dosages.map((dosage, index) => (
            <View key={dosage.id} style={styles.dosageRow}>
              <View style={styles.dosageControl}>
                <Text style={styles.dosageValue}>{dosage.amount}</Text>
                <View style={styles.dosageButtons}>
                  <TouchableOpacity onPress={() => { const n = [...dosages]; n[index].amount++; setDosages(n) }}>
                    <Feather name="chevron-up" size={18} color="#333" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { const n = [...dosages]; n[index].amount = Math.max(1, n[index].amount - 1); setDosages(n) }}>
                    <Feather name="chevron-down" size={18} color="#333" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.timeButton} onPress={() => openTimePicker(index)} disabled={isLoading}>
                <Text style={styles.timeText}>{dosage.time}</Text>
                <Feather name="clock" size={16} color="white" style={{ marginLeft: 5 }} />
              </TouchableOpacity>

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

        {/* Stock & Reminder */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Stock & Reminder</Text>
          <View style={styles.stockReminderRow}>
            <View style={styles.inlineControlContainer}>
              <Text style={styles.inlineControlLabel}>Current Stock</Text>
              <View style={styles.stockControl}>
                <Text style={styles.stockValue}>{stock}</Text>
                <View style={styles.stockButtons}>
                  <TouchableOpacity onPress={() => adjustValue(setStock, stock, 1)}><Feather name="chevron-up" size={18} color="#333" /></TouchableOpacity>
                  <TouchableOpacity onPress={() => adjustValue(setStock, stock, -1)}><Feather name="chevron-down" size={18} color="#333" /></TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={styles.inlineControlContainer}>
              <Text style={styles.inlineControlLabel}>Remind (stock before)</Text>
              <View style={styles.reminderControl}>
                <Text style={styles.reminderValue}>{reminder}</Text>
                <View style={styles.reminderButtons}>
                  <TouchableOpacity onPress={() => adjustValue(setReminder, reminder, 1)}><Feather name="chevron-up" size={18} color="#333" /></TouchableOpacity>
                  <TouchableOpacity onPress={() => adjustValue(setReminder, reminder, -1)}><Feather name="chevron-down" size={18} color="#333" /></TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.slotContainer}>
            <Text style={styles.inlineControlLabel}>Select Slot Number (1-4)</Text>
            <View style={styles.slotControl}>
              <Text style={styles.slotValue}>{slotNumber}</Text>
              <View style={styles.slotButtons}>
                <TouchableOpacity onPress={() => adjustValue(setSlotNumber, slotNumber, 1, 1, 4)} disabled={slotNumber >= 4}>
                  <Feather name="chevron-up" size={18} color={slotNumber >= 4 ? "#ccc" : "#333"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => adjustValue(setSlotNumber, slotNumber, -1, 1, 4)} disabled={slotNumber <= 1}>
                  <Feather name="chevron-down" size={18} color={slotNumber <= 1 ? "#ccc" : "#333"} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={onSave}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>{isLoading ? "Saving..." : "Save Medication"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
    padding: 16,
  },
  medicationName: {
    marginVertical: 16,
    paddingHorizontal: 10,
  },
  nameInput: {
    textAlign: "center", fontWeight: "bold", fontSize: 18, color: "#333",
    backgroundColor: "white", borderRadius: 8, paddingVertical: 12,
    paddingHorizontal: 15, borderWidth: 1, borderColor: "#ddd",
  },
  sectionContainer: {
    backgroundColor: "#ffffff", borderRadius: 10, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 3,
  },
  sectionTitle: {
    fontSize: 17, fontWeight: "600", textAlign: "center", marginBottom: 16, color: "#444",
  },
  quickSelectRow: {
    flexDirection: "row", justifyContent: "center", marginBottom: 12, gap: 8,
  },
  quickSelectButton: {
    backgroundColor: "#CC7755", paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20,
  },
  quickSelectText: { color: "white", fontSize: 13, fontWeight: "500" },
  scheduleTitleContainer: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  addDosageButton: { position: "absolute", right: 0, padding: 5 },
  daysContainer: { alignItems: "stretch" },
  daysRow: {
    flexDirection: "row", justifyContent: "center", marginBottom: 8, flexWrap: "wrap",
  },
  dayButton: {
    backgroundColor: "#CC7755", paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 15, margin: 4, minWidth: 50, alignItems: "center",
  },
  selectedDay: { backgroundColor: "#a1887f" },
  dayText: { color: "white", fontSize: 13 },
  selectedDayText: { fontWeight: "bold" },
  scheduleHeader: {
    flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 5,
    marginBottom: 10, borderBottomWidth: 1, borderBottomColor: "#eee", paddingBottom: 5,
  },
  scheduleHeaderText: { fontSize: 14, fontWeight: "500", color: "#666", flex: 1, textAlign: "center" },
  dosageRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12, paddingHorizontal: 5,
  },
  dosageControl: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#f0f0f0",
    borderRadius: 8, padding: 8, flex: 2, marginRight: 8,
  },
  dosageValue: { flex: 1, textAlign: "center", color: "#333", fontWeight: "bold", fontSize: 16 },
  dosageButtons: { alignItems: "center", marginLeft: 8 },
  timeButton: {
    backgroundColor: "#CC7755", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 10,
    flex: 2, flexDirection: "row", justifyContent: "center", alignItems: "center", marginRight: 8,
  },
  timeText: { color: "white", fontWeight: "bold", fontSize: 16 },
  removeDosageButton: { padding: 5 },
  stockReminderRow: {
    flexDirection: "row", justifyContent: "space-around", alignItems: "flex-start", marginBottom: 16,
  },
  inlineControlContainer: { alignItems: "center", width: "45%" },
  inlineControlLabel: { fontSize: 13, color: "#666", marginBottom: 5 },
  stockControl: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#f0f0f0",
    borderRadius: 8, padding: 8, width: "100%",
  },
  stockValue: { flex: 1, textAlign: "center", color: "#333", fontWeight: "bold", fontSize: 16 },
  stockButtons: { alignItems: "center", marginLeft: 8 },
  reminderControl: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#f0f0f0",
    borderRadius: 8, padding: 8, width: "100%",
  },
  reminderValue: { flex: 1, textAlign: "center", color: "#333", fontWeight: "bold", fontSize: 16 },
  reminderButtons: { alignItems: "center", marginLeft: 8 },
  slotContainer: { alignItems: "center", marginTop: 5 },
  slotControl: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#f0f0f0",
    borderRadius: 8, padding: 8, width: "50%",
  },
  slotValue: { flex: 1, textAlign: "center", color: "#333", fontWeight: "bold", fontSize: 16 },
  slotButtons: { alignItems: "center", marginLeft: 8 },
  saveButton: {
    backgroundColor: "#CC7755", borderRadius: 25, paddingVertical: 15,
    alignItems: "center", marginTop: 10, marginBottom: 20,
  },
  saveButtonDisabled: { backgroundColor: "#cccccc" },
  saveButtonText: { fontSize: 16, fontWeight: "600", color: "white" },
})

export default MedicationDetailScreen;