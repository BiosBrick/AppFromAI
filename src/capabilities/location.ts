import * as Location from 'expo-location';

export function createLocationCapability() {
  return {
    async getCurrentPosition() {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        throw new Error('Permesso posizione negato');
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
      };
    },
  };
}
