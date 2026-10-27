const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix react-native-web 0.20+ AssetRegistry export path for expo-asset
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-web/dist/exports/AssetRegistry': require.resolve(
    'react-native-web/dist/modules/AssetRegistry'
  ),
};

module.exports = config;
