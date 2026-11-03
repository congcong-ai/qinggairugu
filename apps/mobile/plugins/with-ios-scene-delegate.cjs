/* eslint-disable @typescript-eslint/no-require-imports */
const { withInfoPlist } = require('expo/config-plugins');

// Expo 模板显式使用 @objc(SceneDelegate)，运行时类名不带 Swift 模块前缀。
module.exports = function withIosSceneDelegate(config) {
  return withInfoPlist(config, (result) => {
    const scenes =
      result.modResults.UIApplicationSceneManifest?.UISceneConfigurations
        ?.UIWindowSceneSessionRoleApplication;
    for (const scene of scenes ?? []) {
      if (scene.UISceneDelegateClassName?.endsWith('.SceneDelegate')) {
        scene.UISceneDelegateClassName = 'SceneDelegate';
      }
    }
    return result;
  });
};
