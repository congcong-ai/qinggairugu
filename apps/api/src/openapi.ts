import { z } from 'zod';
import {
  createSessionSchema,
  updateSessionSchema,
  joinSessionSchema,
  publishRecapSchema,
  profileSchema,
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
    version: '0.1.0',
    description: '不接收录音、完整私人转写、Embedding 或用户百炼 Key。',
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
    },
  },
  paths: {
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
        summary: '创建一场',
        security: device,
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
      get: {
        summary: '读取已发布回顾，未发布返回 null',
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
