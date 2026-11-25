import process from 'node:process';

export default ({ config }) => {
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!androidGoogleMapsApiKey) return config;

  return {
    ...config,
    plugins: [...(config.plugins ?? []), ['react-native-maps', { androidGoogleMapsApiKey }]],
  };
};
