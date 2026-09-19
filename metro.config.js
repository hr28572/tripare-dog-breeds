// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are .sql files inlined by babel-plugin-inline-import.
config.resolver.sourceExts.push('sql');

module.exports = config;
