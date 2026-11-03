package com.bebackpacker.qinggairugu.wxapi

import android.app.Activity
import android.os.Bundle
import android.content.Intent
import com.tencent.mm.opensdk.openapi.WXAPIFactory
import com.tencent.mm.opensdk.openapi.IWXAPIEventHandler
import com.tencent.mm.opensdk.modelbase.BaseReq
import com.tencent.mm.opensdk.modelbase.BaseResp
import com.tencent.mm.opensdk.modelmsg.SendAuth
import com.bebackpacker.qinggairugu.wechat.WechatModule

class WXEntryActivity : Activity(), IWXAPIEventHandler {
  override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); handle(intent) }
  override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); handle(intent) }
  private fun handle(intent: Intent) {
    try {
      val info = packageManager.getApplicationInfo(packageName, android.content.pm.PackageManager.GET_META_DATA)
      val appId = info.metaData.getString("qinggairugu.wechat.appId") ?: ""
      if (!WXAPIFactory.createWXAPI(this, appId, true).handleIntent(intent, this)) finish()
    } catch (_: Exception) { finish() }
  }
  override fun onReq(req: BaseReq) { finish() }
  override fun onResp(resp: BaseResp) { if (resp is SendAuth.Resp) WechatModule.complete(resp); finish() }
}
