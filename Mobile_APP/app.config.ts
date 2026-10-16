import type { ExpoConfig } from 'expo/config'

const development = process.env.APP_VARIANT === 'development'
const config: ExpoConfig = {
  name: 'Mon Assistant',
  slug: 'egova-assistant',
  version: '1.0.0',
  scheme: 'egova',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.egova.assistant',
    infoPlist: development ? { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } } : {},
  },
  android: { package: 'com.egova.assistant', predictiveBackGestureEnabled: false },
  web: { favicon: './assets/favicon.png', bundler: 'metro' },
  plugins: [
    'expo-router', 'expo-dev-client', 'expo-secure-store', 'expo-document-picker',
    ['expo-speech-recognition', {
      microphonePermission: 'Autoriser le microphone pour dicter une commande après votre accord.',
      speechRecognitionPermission: 'Autoriser la reconnaissance vocale. Ne dictez aucune information confidentielle.',
    }],
    '@config-plugins/react-native-blob-util', '@config-plugins/react-native-pdf',
    ['expo-build-properties', { android: { usesCleartextTraffic: development } }],
  ],
}
export default config
