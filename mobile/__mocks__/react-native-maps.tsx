import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

export default function MockMapView({ children }: PropsWithChildren) {
  return <View testID="mock-map-view">{children}</View>;
}

export function Marker() {
  return <View testID="mock-map-marker" />;
}

export function Circle() {
  return <View testID="mock-map-circle" />;
}
