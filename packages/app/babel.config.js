module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required by Reanimated 4 / Gorhom Bottom Sheet.
      // Keep this last so worklets are transformed after every other plugin.
      'react-native-worklets/plugin',
    ],
  };
};
