import React from "react";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { View, Text, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TabRoot = () => {
  const insets = useSafeAreaInsets();
  
  // Define our theme colors
  const colors = {
    primary: "#D67D4E",
    inactive: "#9E9E9E",
    background: "#FFFFFF",
    shadow: "#00000010"
  };

  // Custom tab bar icon with label
  const TabBarIcon = ({ name, color, label, isFontAwesome = false }) => (
    <View style={{ 
      alignItems: 'center', 
      justifyContent: 'center',
      paddingTop: 5,
      paddingBottom: 2
    }}>
      {isFontAwesome ? (
        <FontAwesome5 name={name} size={20} color={color} solid={color === colors.primary} />
      ) : (
        <MaterialCommunityIcons name={name} size={22} color={color} />
      )}
      <Text style={{ 
        fontSize: 12, 
        marginTop: 2, 
        color: color,
        fontWeight: color === colors.primary ? '500' : '400'
      }}>
        {label}
      </Text>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          height: 60 + (Platform.OS === 'ios' ? insets.bottom : 0),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 5,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          elevation: 0,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
        },
        tabBarShowLabel: false, // Hide default labels since we're using custom ones
        tabBarHideOnKeyboard: true,
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#F0F0F0',
        },
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
          color: '#424242',
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen 
        name="index" 
        options={{
          title: "Medications",
          headerTitleAlign: 'center',
          tabBarIcon: ({ color }) => (
            <TabBarIcon 
              name="home" 
              color={color} 
              label="Meds" 
              isFontAwesome={true} 
            />
          ),
        }}
      />
      
      <Tabs.Screen 
        name="refill" 
        options={{
          title: "Medication Refill",
          headerTitleAlign: 'center',
          tabBarIcon: ({ color }) => (
            <TabBarIcon 
              name="list-alt" 
              color={color} 
              label="Refill" 
              isFontAwesome={true}
            />
          ),
        }}
      />
      
      <Tabs.Screen 
        name="track" 
        options={{
          title: "Track Progress",
          headerTitleAlign: 'center',
          tabBarIcon: ({ color }) => (
            <TabBarIcon 
              name="chart-line" 
              color={color} 
              label="Track" 
              isFontAwesome={true}
            />
          ),
        }}
      />
      
      <Tabs.Screen 
        name="profile" 
        options={{
          title: "My Profile",
          headerTitleAlign: 'center',
          tabBarIcon: ({ color }) => (
            <TabBarIcon 
              name="user" 
              color={color} 
              label="Profile" 
              isFontAwesome={true} 
            />
          ),
        }}
      />
    </Tabs>
  );
};

export default TabRoot;