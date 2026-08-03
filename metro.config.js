const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Intercept react-native-screens before it reaches the Fabric bridge.
// react-native-screens@4.x has a ScreenContainer prop mismatch on Android RN 0.81.5
// (String cannot be cast to Boolean). Returning a no-op mock makes every
// consumer (@react-navigation/stack, /bottom-tabs) fall back to plain View.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-screens') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'src/mocks/react-native-screens-mock.js'),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
