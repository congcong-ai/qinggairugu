# Android 平台参数与后续接入

## Android 应用包名

```text
com.xixisys.pengtou
```

保留已发布包名，不改为拼音品牌名，以兼容已有安装和本机数据。

## Android 应用签名（MD5）

```text
8623e2a23bce2dc239c6341073e97b39
```

2026-10-28使用Android SDK apksigner从 `artifacts/android/ui-review-20261028/qinggai-two-roles-review.apk` 实际核对。填写32位小写、无冒号MD5；不要填写APK文件SHA256或下面的证书SHA256。

证书SHA256仅用于核对原签名身份：

```text
5fb9f9805ba4741171034e3efe50e27b3f42e2b73b4001c00468bdbdcb4140d3
```

## 支持平台

本次申请Android。没有实际发布iOS或鸿蒙版本，不编造Bundle ID、Universal Links或市场地址。

## 微信登录及小程序绑定

移动应用创建后，核实应用审核状态和「微信登录」权限状态；有AppID不等于已有登录权限。需要将移动应用与现有小程序绑定同一微信开放平台账号：

```text
wx066bf055f6b9d415
```

以上是已有小程序AppID，不能作为新移动应用AppID填写。管理员按后台提示扫码完成绑定。不同AppID的OpenID不能直接当作同一身份；只使用微信服务端可信UnionID识别同一用户，缺失或冲突时不自动合并。

## 审核后配置（不填在本次公开材料里）

移动应用AppID与AppSecret分别配置服务端 `WECHAT_MOBILE_APP_ID`、`WECHAT_MOBILE_APP_SECRET`。确认两应用绑定同一开放平台后再配置 `WECHAT_OPEN_PLATFORM_ID`；该变量是本项目用于隔离开放平台身份的固定命名空间，不是要求平台另外颁发一个同名字段。不要将小程序AppID当作开放平台账号标识。

Secret由本人安全填入服务端环境，不发聊天、不写本目录、不放客户端。后续由开发继续接入OpenSDK及真机回归。

## 官方参考与核验限制

- [微信开放平台](https://open.weixin.qq.com/)：创建移动应用与管理微信登录权限。
- [微信官方创建移动应用参数说明入口](https://pay.wechatpay.cn/doc/v3/merchant/4015478291)：引用其中关于创建移动应用、Android包名及签名的说明；本项目本阶段不申请支付。
- [微信官方UnionID与OpenID说明](https://pay.wechatpay.cn/doc/v3/merchant/4012068676)：说明同一开放平台下UnionID及不同AppID的OpenID区别。

本目录表单尺寸与字数限制以用户提供的实际申请页面截图为依据。官方登录开发文档此前无法访问，未据此宣称开发者认证、权限审核或开放平台绑定已完成。
