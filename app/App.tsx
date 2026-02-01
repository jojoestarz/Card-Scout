import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';

export default function App() {
  
  // This function runs when you press the button
  const handleTestPress = () => {
    Alert.alert("It works!", "You are ready to build the Card Finder.");
  };

  return (
    <View style={styles.container}>
      {/* 1. The Header */}
      <Text style={styles.title}>🏴‍☠️ One Piece Card Finder</Text>
      <Text style={styles.subtitle}>Find your favorite cards easily!</Text>
      
      {/* 2. A Mock Search Bar */}
      <View style={styles.searchBox}>
        <TextInput 
          placeholder="Search for cards (e.g., OP05-060)..." 
          placeholderTextColor="#666"
          style={styles.input}
        />
      </View>

      {/* 3. A Test Button */}
      <TouchableOpacity style={styles.button} onPress={handleTestPress}>
        <Text style={styles.buttonText}>Test Connection</Text>
      </TouchableOpacity>

      <StatusBar style="auto" />
    </View>
  );
}

// 4. The Styles (CSS-in-JS)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 0,
    color: '#666',
  },
  searchBox: {
    width: '100%',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  input: {
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF', // Blue color
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});