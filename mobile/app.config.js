import process from 'node:process';

export default ({ config }) => {
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const googleServicesFile = process.env.GOOGLE_SERVICES_FILE?.trim();

  return {
    ...config,
    ...(googleServicesFile ? { android: { ...config.android, googleServicesFile } } : {}),
    plugins: [
      ...(config.plugins ?? []),
      ...(androidGoogleMapsApiKey ? [['react-native-maps', { androidGoogleMapsApiKey }]] : []),
    ],
  };
};
