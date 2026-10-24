import { z } from 'zod';
import {
  createSessionSchema,
  updateSessionSchema,
  joinSessionSchema,
  publishRecapSchema,
  profileSchema,
  entrySchema,
  updateEntrySchema,
  privateAISchema,
} from '@pengtou/contracts';
const device = [{ installationId: [], installationSecret: [] }];
const user = [{ bearer: [] }];
const either = [...device, ...user];
const jsonBody = (schema: unknown) => ({
  required: true,
  content: { 'application/json': { schema } },
});
const schemaRef = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const responses = {
  '200': { description: '操作成功' },
  '400': { description: '请求格式不正确' },
  '401': { description: '身份无效或过期' },
  '403': { description: '没有本场访问权限' },
  '404': { description: '记录不存在' },
  '500': { description: '服务暂时不可用' },
};
const id = [
  {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  },
];
export const openapi = {
  openapi: '3.1.0',
  info: {
    title: '倾盖如故共享 API',
    version: '0.2.0',
    description:
      '录音、Embedding、百炼 Key 不上传。本人明确授权后可同步私有 AI 文本，全文单独选择；与本场共享回顾分别鉴权。',
  },
  components: {
    securitySchemes: {
      installationId: {
        type: 'apiKey',
        in: 'header',
        name: 'x-installation-id',
      },
      installationSecret: {
        type: 'apiKey',
        in: 'header',
        name: 'x-installation-secret',
      },
      bearer: { type: 'http', scheme: 'bearer' },
    },
    schemas: {
      CreateSession: z.toJSONSchema(createSessionSchema),
      UpdateSession: z.toJSONSchema(updateSessionSchema),
      JoinSession: z.toJSONSchema(joinSessionSchema),
      PublishRecap: z.toJSONSchema(publishRecapSchema),
      Profile: z.toJSONSchema(profileSchema),
      PersonalEntry: z.toJSONSchema(entrySchema),
      UpdateEntry: z.toJSONSchema(updateEntrySchema),
      PrivateAI: z.toJSONSchema(privateAISchema),
    },
  },
  paths: {
    '/me/activities': {
      get: {
        summary: '本人统一活动时间线，offset 分页，每页 50 条',
        security: either,
        responses,
      },
    },
    '/me/entries': {
      get: { summary: '本人私人记录', security: either, responses },
      post: {
        summary: '独立记录或关联已加入场次',
        security: either,
        requestBody: jsonBody(schemaRef('PersonalEntry')),
        responses,
      },
    },
    '/me/entries/{id}': {
      parameters: id,
      get: { summary: '读取本人记录', security: either, responses },
      patch: {
        summary: '按 version 更新本人记录或显式关联/解除关联',
        security: either,
        requestBody: jsonBody(schemaRef('UpdateEntry')),
        responses,
      },
      delete: {
        summary: '删除本人文字记录，不影响共享活动',
        security: either,
        responses,
      },
    },
    '/me/private-ai': {
      get: {
        summary: '本人私有同步结果，来源绑定须有效',
        security: either,
        responses,
      },
      put: {
        summary: '绑定 App 明确授权的文字同步，最大 4 MiB',
        security: device,
        requestBody: jsonBody(schemaRef('PrivateAI')),
        responses,
      },
    },
    '/me/private-ai/state/{id}': {
      parameters: id,
      get: {
        summary:
          '当前绑定设备的同步版本及授权范围，不返回正文；sourceVersion 用于提示本地有待同步的新版本',
        security: device,
        responses,
      },
    },
    '/me/private-ai/{id}': {
      parameters: id,
      delete: {
        summary: '删除云端副本并保留撤销版本防止旧任务复活',
        security: either,
        responses,
      },
    },
    '/bindings': {
      get: { summary: '本人有效关联设备', security: either, responses },
    },
    '/bindings/challenges': {
      post: {
        summary: 'App 申请 5 分钟一次性关联码',
        security: device,
        responses,
      },
    },
    '/bindings/claim': {
      post: {
        summary: '微信用户确认认领关联码，限速 10 次/5 分钟',
        security: user,
        requestBody: jsonBody({
          type: 'object',
          required: ['code'],
          properties: { code: { type: 'string' } },
        }),
        responses,
      },
    },
    '/bindings/challenges/{id}': {
      parameters: id,
      get: { summary: '来源设备查看认领状态', security: device, responses },
    },
    '/bindings/challenges/{id}/confirm': {
      parameters: id,
      post: {
        summary: '来源设备核对微信身份后确认关联',
        security: device,
        requestBody: jsonBody({
          type: 'object',
          required: ['confirm'],
          properties: { confirm: { const: true } },
        }),
        responses,
      },
    },
    '/bindings/{id}': {
      parameters: id,
      delete: {
        summary: '本人或来源设备解绑，删除私有 AI 副本',
        security: either,
        responses,
      },
    },
    '/me/data': {
      delete: {
        summary: '微信用户明确删除本人云端资料并注销关联',
        security: user,
        responses,
      },
    },
    '/health': {
      get: {
        summary: '健康检查',
        responses: { '200': { description: '服务正常' } },
      },
    },
    '/installations': {
      post: {
        summary: '登记匿名设备身份',
        requestBody: jsonBody({
          type: 'object',
          required: ['id', 'secret'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            secret: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          },
        }),
        responses: { ...responses, '201': { description: '设备已登记' } },
      },
    },
    '/auth/wechat': {
      post: {
        summary: '用 wx.login code 建立身份',
        requestBody: jsonBody({
          type: 'object',
          required: ['code'],
          properties: { code: { type: 'string' } },
        }),
        responses,
      },
    },
    '/sessions': {
      post: {
        summary: '设备或微信用户发起一场',
        security: either,
        requestBody: jsonBody(schemaRef('CreateSession')),
        responses: { ...responses, '201': { description: '已创建或幂等返回' } },
      },
    },
    '/sessions/{id}': {
      parameters: id,
      get: { summary: '获取本场基本信息', responses },
      patch: {
        summary: '主办方修改本场',
        security: device,
        requestBody: jsonBody(schemaRef('UpdateSession')),
        responses,
      },
    },
    '/sessions/{id}/join': {
      parameters: id,
      post: {
        summary: '明确确认后加入，按需保存资料',
        security: user,
        requestBody: jsonBody(schemaRef('JoinSession')),
        responses: { ...responses, '201': { description: '已加入' } },
      },
    },
    '/sessions/{id}/participants': {
      parameters: id,
      get: { summary: '按本场可见范围读取参与者', security: either, responses },
    },
    '/sessions/{id}/qr': {
      parameters: id,
      get: {
        summary: '主办方获取官方小程序码或开发调试码',
        security: device,
        responses,
      },
    },
    '/sessions/{id}/recap': {
      parameters: id,
      delete: { summary: '发起者撤回共享回顾', security: either, responses },
      get: {
        summary: '读取已发布回顾，未发布/撤回返回 null，并返回当前 version',
        security: either,
        responses,
      },
      post: {
        summary: '主办方明确发布共享回顾',
        security: device,
        requestBody: jsonBody(schemaRef('PublishRecap')),
        responses,
      },
    },
    '/me/profile': {
      get: { summary: '读取已保存资料', security: user, responses },
      put: {
        summary: '修改已保存资料，不改历史快照',
        security: user,
        requestBody: jsonBody(schemaRef('Profile')),
        responses,
      },
      delete: {
        summary: '删除保存资料，不改历史快照',
        security: user,
        responses,
      },
    },
    '/me/sessions': {
      get: { summary: '我参加过的', security: user, responses },
    },
  },
};
