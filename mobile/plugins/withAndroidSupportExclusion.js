const { withAppBuildGradle } = require('@expo/config-plugins')

// react-native-razorpay pulls in com.android.support:support-compat:28.0.0
// which duplicates classes already in androidx.core. This plugin excludes the
// old support library from all configurations to resolve the conflict.
module.exports = function withAndroidSupportExclusion(config) {
  return withAppBuildGradle(config, (mod) => {
    const gradle = mod.modResults.contents

    const exclusionBlock = `
// Exclude legacy android.support to avoid duplicate class conflict with androidx
configurations.all {
    exclude group: 'com.android.support', module: 'support-compat'
    exclude group: 'com.android.support', module: 'support-core-utils'
    exclude group: 'com.android.support', module: 'support-annotations'
    exclude group: 'com.android.support', module: 'versionedparcelable'
}
`

    if (!gradle.includes('exclude group: \'com.android.support\'')) {
      mod.modResults.contents = gradle.replace(
        /android\s*\{/,
        `android {\n${exclusionBlock}`
      )
    }

    return mod
  })
}
