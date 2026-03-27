import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet } from "react-native";
import DashboardScreen from "./src/screens/DashboardScreen";

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <DashboardScreen />
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
});
