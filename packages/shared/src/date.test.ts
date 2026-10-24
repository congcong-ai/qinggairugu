import { it, expect } from 'vitest';
import { localDateInput, dateInputToISOString } from './index';
function inTimezone(zone: string, run: () => void) {
  const old = process.env.TZ;
  process.env.TZ = zone;
  try {
    run();
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
}
it.each([
  ['Asia/Shanghai', '2026-10-22T16:05:00Z', '2026-10-23'],
  ['America/Los_Angeles', '2026-10-23T02:05:00Z', '2026-10-22'],
  ['Pacific/Auckland', '2026-10-22T11:05:00Z', '2026-10-23'],
])('%s 按设备日历回显日期，不截取 UTC 日期', (zone, instant, day) => {
  inTimezone(zone, () => expect(localDateInput(new Date(instant))).toBe(day));
});
it.each(['Asia/Shanghai', 'America/New_York', 'Pacific/Auckland'])(
  '%s 日期保存和重开不偏移，兼容夏令时日期',
  (zone) => {
    inTimezone(zone, () => {
      for (const day of ['2026-03-08', '2026-10-23', '2024-02-29']) {
        const iso = dateInputToISOString(day);
        expect(iso.endsWith('Z')).toBe(true);
        expect(localDateInput(new Date(iso))).toBe(day);
      }
    });
  },
);
it.each([
  '2026-02-29',
  '2026-04-31',
  '2026-13-01',
  '2026-00-23',
  '2026-10-00',
  '2026-1-1',
  '不是日期',
  '',
])('拒绝无效日期 %s，不默默保存为另一日', (value) => {
  expect(() => dateInputToISOString(value)).toThrow('日期');
});
