import { Stack } from "expo-router";
import React from "react";
import { View,Text } from "react-native";

const RootLayout = () => {
    return (
        <Stack
        screenOptions={{
            headerStyle: {
                backgroundColor: "#0931e3",
            },
            headerTintColor: "#fff",
            headerTitleStyle: {
                fontWeight: "bold",
            },
        }}
        
        >
            <Stack.Screen name="(tab)" options={{headerShown:false}} />
            <Stack.Screen name="index" options={{headerShown:false}} />
            <Stack.Screen name="login" options={{headerShown:false}} />
            <Stack.Screen name="signup" options={{headerShown:false}} />
            <Stack.Screen name="add" options={{headerShown:false}} />
            
        </Stack>
    );
};

export default RootLayout;