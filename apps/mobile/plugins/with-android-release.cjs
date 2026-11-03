/* eslint-disable @typescript-eslint/no-require-imports */
const {
  withAppBuildGradle,
  withGradleProperties,
} = require('expo/config-plugins');
module.exports = function withAndroidRelease(config) {
  config = withGradleProperties(config, (result) => {
    result.modResults = result.modResults.filter(
      (p) =>
        p.type !== 'property' || p.key !== 'EX_DEV_CLIENT_NETWORK_INSPECTOR',
    );
    result.modResults.push({
      type: 'property',
      key: 'EX_DEV_CLIENT_NETWORK_INSPECTOR',
      value: 'false',
    });
    return result;
  });
  return withAppBuildGradle(config, (result) => {
    const marker =
      '// 倾盖如故正式签名：缺少配置时生成未签名包，绝不冒用 debug 签名。';
    if (
      !result.modResults.contents.includes(
        "def qinggairuguStore = System.getenv('QINGGAIRUGU_KEYSTORE_FILE')",
      )
    )
      result.modResults.contents += `
${marker}
def qinggairuguStore = System.getenv('QINGGAIRUGU_KEYSTORE_FILE')
android {
    signingConfigs {
        if (qinggairuguStore) {
            qinggairuguRelease {
                storeFile file(qinggairuguStore)
                storePassword System.getenv('QINGGAIRUGU_KEYSTORE_PASSWORD')
                keyAlias System.getenv('QINGGAIRUGU_KEY_ALIAS')
                keyPassword System.getenv('QINGGAIRUGU_KEY_PASSWORD')
            }
        }
    }
    buildTypes {
        release {
            signingConfig qinggairuguStore ? signingConfigs.qinggairuguRelease : null
        }
    }
}
`;
    return result;
  });
};
