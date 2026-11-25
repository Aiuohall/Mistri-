import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import type { MapProviderProps } from './types';

function deltaForRadius(radiusMeters?: number): number {
  if (!radiusMeters) return 0.015;
  return Math.max(0.015, Math.min(0.4, (radiusMeters / 111_000) * 2.4));
}

export function MapProvider({
  center,
  radiusMeters,
  pins = [],
  title,
  attribution,
}: MapProviderProps) {
  const delta = deltaForRadius(radiusMeters);
  return (
    <View accessibilityLabel={title} style={mapStyles.container}>
      <Text style={mapStyles.title}>{title}</Text>
      <MapView
        style={mapStyles.map}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
        region={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
      >
        {radiusMeters && (
          <Circle
            center={center}
            radius={radiusMeters}
            strokeColor="rgba(23, 98, 78, 0.7)"
            fillColor="rgba(23, 98, 78, 0.12)"
          />
        )}
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={pin.coordinate}
            title={pin.title}
            description={pin.description}
          />
        ))}
      </MapView>
      <Text style={mapStyles.attribution}>{attribution}</Text>
    </View>
  );
}

const mapStyles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#b7cbc1',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f8f5',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#123b32',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  map: {
    width: '100%',
    height: 220,
  },
  attribution: {
    fontSize: 12,
    color: '#5a6e66',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
