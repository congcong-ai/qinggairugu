package com.bebackpacker.qinggairugu.wechat

import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.*
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager
import com.tencent.mm.opensdk.modelmsg.SendAuth
import com.tencent.mm.opensdk.openapi.WXAPIFactory
import java.security.SecureRandom

class WechatModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "QinggaiWechat"
  companion object {
    private var pending: Promise? = null
    private var state: String? = null
    private var deadline = 0L
    private val handler = Handler(Looper.getMainLooper())
    private val timeout = Runnable { complete(null, "微信授权已超时，请重试") }
    @Synchronized fun complete(response: SendAuth.Resp?, error: String? = null) {
      val promise = pending ?: return
      pending = null
      handler.removeCallbacks(timeout)
      val valid = response != null && response.state == state && android.os.SystemClock.elapsedRealtime() < deadline
      state = null
      if (error != null) promise.reject("WECHAT_AUTH", error)
      else if (!valid) promise.reject("WECHAT_STATE", "微信授权校验失败，请重新登录")
      else when (response!!.errCode) {
        0 -> if (!response.code.isNullOrBlank()) promise.resolve(response.code) else promise.reject("WECHAT_CODE", "微信未返回授权码")
        -2 -> promise.reject("WECHAT_CANCEL", "已取消微信登录")
        -4 -> promise.reject("WECHAT_DENIED", "微信授权未获同意")
        else -> promise.reject("WECHAT_AUTH", "微信授权失败，请重试")
      }
    }
  }
  @ReactMethod fun authorize(appId: String, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      if (pending != null) { promise.reject("WECHAT_BUSY", "微信登录正在进行"); return@runOnUiThread }
      if (!appId.matches(Regex("wx[a-f0-9]{16}"))) { promise.reject("WECHAT_CONFIG", "微信AppID未配置"); return@runOnUiThread }
      try {
        val api = WXAPIFactory.createWXAPI(reactApplicationContext, appId, true)
        if (!api.isWXAppInstalled) { promise.reject("WECHAT_MISSING", "请先安装微信"); return@runOnUiThread }
        api.registerApp(appId)
        val bytes = ByteArray(32); SecureRandom().nextBytes(bytes)
        val nonce = bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
        state = nonce; pending = promise; deadline = android.os.SystemClock.elapsedRealtime() + 300000
        handler.postDelayed(timeout, 300000)
        val request = SendAuth.Req().apply { scope = "snsapi_userinfo"; state = nonce }
        if (!api.sendReq(request)) complete(null, "无法打开微信授权，请重试")
      } catch (_: Exception) { if (pending != null) complete(null, "微信登录暂不可用") else promise.reject("WECHAT_AUTH", "微信登录暂不可用") }
    }
  }
  override fun invalidate() { complete(null, "登录页面已关闭，请重试"); super.invalidate() }
}
class WechatPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(WechatModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
