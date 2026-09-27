import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    console.log("Username:", username);
    console.log("Password:", password);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.circleTop} />
        <View style={styles.circleBottom} />
        <View style={styles.circleRight} />

        <View style={styles.loginCard}>

          <View style={styles.logoContainer}>
            
            <Text style={styles.logoText}>
              My<Text style={styles.logoBlue}>Deadline</Text>
            </Text>

            <Text style={styles.subtitle}>
              Tugas kuliah, lebih terarah.
            </Text>
          </View>

          <View style={styles.inputContainer}>

            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#8A98AD"
              value={username}
              onChangeText={setUsername}
            />
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#8A98AD"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Login */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
          >
            <Text style={styles.loginText}>Login</Text>
          </TouchableOpacity>

          {/* Keterangan */}
          <View style={styles.infoContainer}>
            
            <Text style={styles.infoText}>
              Hanya untuk 2 pengguna
            </Text>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EEF5FF",
  },

  keyboard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  circleTop: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#C7DBFF",
    top: -75,
    left: -75,
  },

  circleBottom: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#C7DBFF",
    bottom: -100,
    left: -70,
  },

  circleRight: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#C7DBFF",
    right: -75,
    top: "45%",
  },

  loginCard: {
    width: "85%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 28,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.08,
    shadowRadius: 15,

    elevation: 5,
  },

  logoContainer: {
    alignItems: "center",
    marginBottom: 30,
  },

  logoText: {
    fontSize: 29,
    fontWeight: "700",
    color: "#15263F",
    marginTop: 5,
  },

  logoBlue: {
    color: "#1463E8",
  },

  subtitle: {
    marginTop: 5,
    color: "#68778D",
    fontSize: 14,
  },

  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: "#D8E1ED",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 14,
  },

  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#1E293B",
  },

  loginButton: {
    height: 50,
    backgroundColor: "#1463E8",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },

  loginText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },

  infoContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },

  infoText: {
    marginLeft: 6,
    color: "#64748B",
    fontSize: 12,
  },
});