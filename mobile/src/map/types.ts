export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type MapPin = {
  id: string;
  coordinate: MapCoordinate;
  title: string;
  description?: string;
};

export type MapProviderProps = {
  center: MapCoordinate;
  radiusMeters?: number;
  pins?: MapPin[];
  title: string;
  attribution: string;
};
