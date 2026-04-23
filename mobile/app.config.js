// Dynamic config — allows Google Maps keys to come from EAS secrets / .env
// Run: eas secret:create --name GOOGLE_MAPS_ANDROID_KEY --value <your-key>
//      eas secret:create --name GOOGLE_MAPS_IOS_KEY     --value <your-key>
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY ?? '',
    },
  },
  android: {
    ...config.android,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY ?? '',
      },
    },
  },
})
