package ru.morius.khvoya

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.PowerManager

/**
 * Пока музыка играет, служба висит с уведомлением — иначе система усыпит процесс,
 * и звук в WebView оборвётся на погашенном экране.
 *
 * Здесь она только живёт. Обложку, название и кнопки на экране блокировки добавляет Task 8.
 */
class PlaybackService : Service() {
  private var wake: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    // канал без звука и без вибрации: это не уведомление, а признак живой службы
    nm.createNotificationChannel(NotificationChannel(CHANNEL, "Воспроизведение", NotificationManager.IMPORTANCE_LOW))
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val n: Notification = Notification.Builder(this, CHANNEL)
      .setContentTitle("Хвоя играет")
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setOngoing(true)
      .build()
    startForeground(ID, n)
    // процессор не должен засыпать вместе с экраном, пока идёт звук
    if (wake == null) {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "khvoya:playback").apply { setReferenceCounted(false); acquire(TIMEOUT) }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    wake?.let { if (it.isHeld) it.release() }
    wake = null
    super.onDestroy()
  }

  companion object {
    private const val CHANNEL = "khvoya-playback"
    private const val ID = 1
    /** Предохранитель: если про службу забыли, блокировка сама отпустится через 4 часа. */
    private const val TIMEOUT = 4L * 60 * 60 * 1000

    // @JvmStatic — иначе Java из MainActivity этих функций не видит
    @JvmStatic fun start(ctx: Context) = ctx.startForegroundService(Intent(ctx, PlaybackService::class.java))
    @JvmStatic fun stop(ctx: Context) = ctx.stopService(Intent(ctx, PlaybackService::class.java))
  }
}
