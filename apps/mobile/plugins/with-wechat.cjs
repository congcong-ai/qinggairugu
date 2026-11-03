/* eslint-disable @typescript-eslint/no-require-imports */
const {
  withAndroidManifest,
  withAppBuildGradle,
  withMainApplication,
  withDangerousMod,
} = require('expo/config-plugins');
const { mkdirSync, copyFileSync } = require('node:fs');
const { join } = require('node:path');
module.exports = function withWechat(config, { appId }) {
  if (!/^wx[a-f0-9]{16}$/.test(appId || ''))
    throw new Error('微信移动应用AppID格式不正确');
  config = withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    manifest.queries ??= [];
    manifest.queries.push({
      package: [{ $: { 'android:name': 'com.tencent.mm' } }],
    });
    const app = manifest.application[0];
    app['meta-data'] ??= [];
    app['meta-data'] = app['meta-data'].filter(
      (x) => x.$['android:name'] !== 'qinggairugu.wechat.appId',
    );
    app['meta-data'].push({
      $: { 'android:name': 'qinggairugu.wechat.appId', 'android:value': appId },
    });
    app.activity ??= [];
    app.activity = app.activity.filter(
      (x) => x.$['android:name'] !== '.wxapi.WXEntryActivity',
    );
    app.activity.push({
      $: {
        'android:name': '.wxapi.WXEntryActivity',
        'android:exported': 'true',
        'android:launchMode': 'singleTask',
        'android:taskAffinity': config.android.package,
        'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
      },
    });
    return result;
  });
  config = withAppBuildGradle(config, (result) => {
    if (
      !result.modResults.contents.includes(
        'com.tencent.mm.opensdk:wechat-sdk-android:',
      )
    )
      result.modResults.contents +=
        '\ndependencies { implementation "com.tencent.mm.opensdk:wechat-sdk-android:6.8.40" }\n';
    return result;
  });
  config = withMainApplication(config, (result) => {
    if (
      !result.modResults.contents.includes(
        'add(com.bebackpacker.qinggairugu.wechat.WechatPackage())',
      )
    )
      result.modResults.contents = result.modResults.contents.replace(
        'PackageList(this).packages.apply {',
        'PackageList(this).packages.apply {\n          add(com.bebackpacker.qinggairugu.wechat.WechatPackage())',
      );
    return result;
  });
  return withDangerousMod(config, [
    'android',
    async (result) => {
      const base = join(
        result.modRequest.platformProjectRoot,
        'app/src/main/java/com/bebackpacker/qinggairugu',
      );
      for (const [folder, file] of [
        ['wechat', 'WechatModule.kt'],
        ['wxapi', 'WXEntryActivity.kt'],
      ]) {
        mkdirSync(join(base, folder), { recursive: true });
        copyFileSync(
          join(result.modRequest.projectRoot, 'native/wechat', file),
          join(base, folder, file),
        );
      }
      return result;
    },
  ]);
};
