import { StyleSheet, Text, View } from 'react-native';
import type { MapProviderProps } from './types';

export function MapProvider({
  center,
  radiusMeters,
  pins = [],
  title,
  attribution,
}: MapProviderProps) {
  return (
    <View accessibilityLabel={title} style={mapStyles.fallbackCard}>
      <Text style={mapStyles.title}>{title}</Text>
      <Text style={mapStyles.coords}>
        {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
        {radiusMeters ? ` · ${(radiusMeters / 1000).toFixed(1)} km` : ''}
      </Text>
      {pins.map((pin) => (
        <Text key={pin.id} style={mapStyles.pin}>
          {pin.title}
          {pin.description ? ` — ${pin.description}` : ''}
        </Text>
      ))}
      <Text style={mapStyles.attribution}>{attribution}</Text>
    </View>
  );
}

const mapStyles = StyleSheet.create({
  fallbackCard: {
    borderWidth: 1,
    borderColor: '#b7cbc1',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#f3f8f5',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#123b32',
  },
  coords: {
    fontSize: 14,
    color: '#254a40',
  },
  pin: {
    fontSize: 14,
    color: '#172c25',
  },
  attribution: {
    fontSize: 12,
    color: '#5a6e66',
  },
});
