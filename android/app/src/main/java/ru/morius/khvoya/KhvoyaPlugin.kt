package ru.morius.khvoya

import android.annotation.SuppressLint
import android.app.Dialog
import android.content.Intent as AndroidIntent
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import androidx.core.content.FileProvider
import java.io.BufferedReader
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Три куска, ради которых вообще нужен нативный код:
 * запрос с настоящим User-Agent, экран входа на сайте ВК и очистка cookie при выходе.
 * Всё остальное делает окно на TypeScript.
 */
@CapacitorPlugin(name = "Khvoya")
class KhvoyaPlugin : Plugin() {
  private val pool = Executors.newFixedThreadPool(4)

  /**
   * Браузер запрещает задавать User-Agent и не пустит на api.vk.com из-за CORS,
   * поэтому запрос уходит отсюда. Cookie берём те же, что у WebView: по ним ВК отдаёт ключ.
   */
  @PluginMethod
  fun request(call: PluginCall) {
    val url = call.getString("url") ?: return call.reject("Нет адреса")
    val method = call.getString("method") ?: "GET"
    val body = call.getString("body")
    val headers = call.getObject("headers") ?: JSObject()
    pool.execute {
      try {
        val c = (URL(url).openConnection() as HttpURLConnection).apply {
          requestMethod = method
          connectTimeout = 20000
          readTimeout = 30000
          instanceFollowRedirects = true
        }
        val it = headers.keys()
        while (it.hasNext()) { val k = it.next(); c.setRequestProperty(k, headers.getString(k)) }
        CookieManager.getInstance().getCookie(url)?.let { c.setRequestProperty("Cookie", it) }
        if (body != null && method != "GET") {
          c.doOutput = true
          c.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
        }
        val code = c.responseCode
        val text = (if (code >= 400) c.errorStream else c.inputStream)
          ?.bufferedReader()?.use(BufferedReader::readText) ?: ""
        call.resolve(JSObject().put("status", code).put("body", text))
      } catch (e: Exception) {
        // текст наружу переводит friendly() в окне — сюда кладём то, что он узнаёт
        call.reject("fetch failed: ${e.message}")
      }
    }
  }

  /**
   * Вход: открываем настоящий сайт ВК. Как входить — дело твоё и ВК: QR, код, пароль, 2FA.
   * Как только страница ВК отдаёт ключ — окно закрывается. Пароль через нас не проходит.
   */
  @SuppressLint("SetJavaScriptEnabled")
  @PluginMethod
  fun login(call: PluginCall) {
    Handler(Looper.getMainLooper()).post {
      val ctx = activity ?: return@post call.reject("Нет окна")
      val web = WebView(ctx)
      web.settings.javaScriptEnabled = true
      web.settings.domStorageEnabled = true
      // заголовок не подменяем: выдавать телефон за десктопный браузер нельзя,
      // ВК это замечает и вход по QR перестаёт работать
      CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)

      val dialog = Dialog(ctx, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
      dialog.setContentView(web, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
      var done = false
      val finish = { result: JSObject ->
        if (!done) {
          done = true
          CookieManager.getInstance().flush()
          dialog.dismiss()
          call.resolve(result)
        }
      }

      // Скрипт нужен под тот домен, на котором ты вошёл: cookie у vk.ru и vk.com разные.
      val scriptRu = call.getString("scriptRu") ?: ""
      val scriptCom = call.getString("scriptCom") ?: ""
      val probe = {
        // Спрашиваем ключ ТОЛЬКО когда ты уже на vk.com. На страницах входа (id.vk.com,
        // login.vk.ru) молчим: иначе это десятки неавторизованных запросов подряд,
        // и ВК отвечает «слишком много попыток», а вход по QR ломается первым.
        val tld = pageTld(web.url)
        if (!done && tld != null) {
          // evaluateJavascript не умеет ждать обещания: отдал бы сам объект, а не ответ ВК.
          // Поэтому запрос запускаем один раз и складываем текст в окно, а дальше забираем готовое.
          val inner = if (tld == "com") scriptCom else scriptRu
          val wrapped = "(function(){ if(!window.__khvoyaGoing){ window.__khvoyaGoing=1; (" + inner +
            ").then(function(t){window.__khvoyaToken=t}).catch(function(){window.__khvoyaGoing=0}) } return window.__khvoyaToken || '' })()"
          web.evaluateJavascript(wrapped) { raw ->
            // результат приходит строкой JSON — разворачиваем один слой
            val text = unquote(raw)
            if (text.contains("access_token")) finish(JSObject().put("body", text))
          }
        }
      }

      web.webViewClient = object : WebViewClient() {
        override fun onPageFinished(view: WebView?, url: String?) { probe() }
      }
      // ключ может появиться и без перезагрузки страницы, но торопиться незачем
      val tick = object : Runnable {
        override fun run() {
          if (done) return
          probe()
          Handler(Looper.getMainLooper()).postDelayed(this, 3000)
        }
      }
      Handler(Looper.getMainLooper()).postDelayed(tick, 3000)

      dialog.setOnCancelListener { if (!done) { done = true; call.resolve(JSObject().put("error", "Окно входа закрыто")) } }
      dialog.show()
      web.loadUrl(call.getString("url") ?: "https://vk.com/")
    }
  }

  /** Настоящий заголовок WebView: им же ходим за ключом, чтобы не расходиться с окном входа. */
  @PluginMethod
  fun userAgent(call: PluginCall) {
    call.resolve(JSObject().put("value", WebSettings.getDefaultUserAgent(context)))
  }

  @PluginMethod
  fun logout(call: PluginCall) {
    Handler(Looper.getMainLooper()).post {
      CookieManager.getInstance().removeAllCookies { CookieManager.getInstance().flush() }
      call.resolve()
    }
  }

  /**
   * Скачать apk обновления. Через обычный ответ его не пронести — он двоичный,
   * поэтому кладём в кэш и отдаём путь.
   */
  @PluginMethod
  fun downloadApk(call: PluginCall) {
    val url = call.getString("url") ?: return call.reject("Нет адреса")
    pool.execute {
      try {
        val out = File(context.cacheDir, "khvoya-update.apk")
        (URL(url).openConnection() as HttpURLConnection).apply {
          connectTimeout = 20000
          readTimeout = 120000
          instanceFollowRedirects = true
        }.inputStream.use { input -> out.outputStream().use { input.copyTo(it) } }
        call.resolve(JSObject().put("path", out.absolutePath))
      } catch (e: Exception) {
        call.reject("fetch failed: ${e.message}")
      }
    }
  }

  /** Открыть установщик Android. Дальше решает человек — поставить или отказаться. */
  @PluginMethod
  fun installApk(call: PluginCall) {
    val path = call.getString("path") ?: return call.reject("Нет файла")
    Handler(Looper.getMainLooper()).post {
      try {
        val uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", File(path))
        val i = AndroidIntent(AndroidIntent.ACTION_VIEW).apply {
          setDataAndType(uri, "application/vnd.android.package-archive")
          addFlags(AndroidIntent.FLAG_GRANT_READ_URI_PERMISSION or AndroidIntent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(i)
        call.resolve()
      } catch (e: Exception) {
        call.reject("Не удалось открыть установщик: ${e.message}")
      }
    }
  }

  /** Пока музыка играет — служба живёт, иначе система усыпит процесс. */
  @PluginMethod
  fun playback(call: PluginCall) {
    val on = call.getBoolean("on") ?: false
    val ctx = context
    Handler(Looper.getMainLooper()).post {
      if (on) PlaybackService.start(ctx) else PlaybackService.stop(ctx)
      call.resolve()
    }
  }

  /** То же, что `pageTld` на компьютере: домен вошедшей страницы; страницы входа не считаются. */
  private fun pageTld(url: String?): String? {
    val u = url ?: return null
    return Regex("^https://(?:m\\.)?vk\\.(ru|com)(/|\$)").find(u)?.groupValues?.get(1)
  }

  private fun unquote(raw: String?): String {
    val s = raw ?: return ""
    if (s.length < 2 || !s.startsWith("\"")) return s
    return s.substring(1, s.length - 1)
      .replace("\\\"", "\"").replace("\\\\", "\\").replace("\\n", "\n").replace("\\u003C", "<")
  }
}
