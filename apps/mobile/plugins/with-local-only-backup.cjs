/* eslint-disable @typescript-eslint/no-require-imports */
const {
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');
// 覆盖普通和设备加密存储，避免录音、照片、SQLite 与身份凭据进入系统备份/换机。
const domains = [
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
];
const exclusions = domains
  .map((domain) => `    <exclude domain="${domain}" path="." />`)
  .join('\n');
module.exports = function withLocalOnlyBackup(config) {
  config = withAndroidManifest(config, (result) => {
    const app = result.modResults.manifest.application[0].$;
    app['android:allowBackup'] = 'false';
    app['android:fullBackupContent'] = '@xml/qinggai_backup_rules';
    app['android:dataExtractionRules'] = '@xml/qinggai_data_extraction_rules';
    return result;
  });
  return withDangerousMod(config, [
    'android',
    async (result) => {
      const directory = path.join(
        result.modRequest.platformProjectRoot,
        'app/src/main/res/xml',
      );
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(
        path.join(directory, 'qinggai_backup_rules.xml'),
        `<?xml version="1.0" encoding="utf-8"?>\n<full-backup-content>\n${exclusions}\n</full-backup-content>\n`,
      );
      await fs.writeFile(
        path.join(directory, 'qinggai_data_extraction_rules.xml'),
        `<?xml version="1.0" encoding="utf-8"?>\n<data-extraction-rules>\n  <cloud-backup>\n${exclusions}\n  </cloud-backup>\n  <device-transfer>\n${exclusions}\n  </device-transfer>\n</data-extraction-rules>\n`,
      );
      return result;
    },
  ]);
};
