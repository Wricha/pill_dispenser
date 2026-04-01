import React from "react";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { View, Text, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TabRoot = () => {
  const insets = useSafeAreaInsets();

  const colors = {
    primary: "#D67D4E",
    inactive: "#9E9E9E",
    background: "#FFFFFF",
  };

  const TabBarIcon = ({ name, color, label, isFontAwesome = false, focused }: { name: any, color: string, label: string, isFontAwesome?: boolean, focused: boolean }) => (
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
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          // Full width, no floating — sits between content and phone nav bar
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60 + insets.bottom,          // grows to cover Android nav bar / iPhone home bar
          paddingTop: 10,
          paddingBottom: insets.bottom || 8,    // pushes icons up above home indicator
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          // No marginHorizontal, no borderRadius — full-width bar
        },
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="home" color={color} label="Meds" isFontAwesome focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="refill"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="list-alt" color={color} label="Refill" isFontAwesome focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="chart-line" color={color} label="Track" isFontAwesome focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="user" color={color} label="Profile" isFontAwesome focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
};

export default TabRoot;