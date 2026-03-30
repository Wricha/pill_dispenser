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

  // Custom tab bar icon with label and pill background
  const TabBarIcon = ({ name, color, label, isFontAwesome = false, focused }) => (
    <View style={{
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 6,
      paddingBottom: 2,
      minWidth: 54,
    }}>
      {isFontAwesome ? (
        <FontAwesome5 name={name} size={20} color={focused ? colors.primary : color} solid={focused} />
      ) : (
        <MaterialCommunityIcons name={name} size={22} color={focused ? colors.primary : color} />
      )}
      <Text
        style={{
          fontSize: 13,
          marginTop: 2,
          color: focused ? colors.primary : color,
          fontWeight: focused ? '600' : '400',
          letterSpacing: 0.2,
          minWidth: 36,
          textAlign: 'center',
        }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
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
          height: 70 + (Platform.OS === 'ios' ? insets.bottom : 0),
          paddingBottom: (Platform.OS === 'ios' ? insets.bottom : 10) + 18, // add extra margin
          paddingTop: 14,
          marginHorizontal: 14,
          marginBottom: 14,
          borderRadius: 28,
          backgroundColor: '#fff',
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
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
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon 
              name="home" 
              color={color} 
              label="Meds" 
              isFontAwesome={true} 
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen 
        name="refill" 
        options={{
          title: "Medication Refill",
          headerTitleAlign: 'center',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon 
              name="list-alt" 
              color={color} 
              label="Refill" 
              isFontAwesome={true}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen 
        name="track" 
        options={{
          title: "Track Progress",
          headerTitleAlign: 'center',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon 
              name="chart-line" 
              color={color} 
              label="Track" 
              isFontAwesome={true}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen 
        name="profile" 
        options={{
          title: "My Profile",
          headerTitleAlign: 'center',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon 
              name="user" 
              color={color} 
              label="Profile" 
              isFontAwesome={true} 
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
};

export default TabRoot;