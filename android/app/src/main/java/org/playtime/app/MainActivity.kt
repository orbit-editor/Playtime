package org.playtime.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import java.io.File
import java.util.concurrent.Executors
import mobile.Mobile

/**
 * 全屏横屏的 Android 外壳：启动内置的 Go 服务（mobile.Start），再用 WebView 打开它。
 *
 * 服务本身由 [PlaytimeService] 以前台服务持有，Activity 只负责显示，所以旋转、
 * 切后台都不会重启服务；Activity 真正退出时才停掉服务。
 */
class MainActivity : ComponentActivity() {

    private lateinit var root: FrameLayout
    private lateinit var notice: LinearLayout
    private lateinit var noticeTitle: TextView
    private lateinit var noticeDetail: TextView
    private lateinit var noticeAction: Button

    private var webView: WebView? = null
    private var noticeVisible = true

    private val mainHandler = Handler(Looper.getMainLooper())
    private val startup = Executors.newSingleThreadExecutor()
    private var lastBackPressAt = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 教室里的平板不要自动息屏。
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        root = FrameLayout(this)
        root.setBackgroundColor(getColor(R.color.paper))
        setContentView(root)

        buildNotice()
        showNotice(getString(R.string.loading_title), getString(R.string.loading_detail))
        handleBackPress()
        requestNotificationPermission()
        goImmersive()

        // WebView 太旧时直接显示升级提示，不启动服务。
        val webViewName = oldWebViewVersionName()
        if (webViewName != null) {
            showUpgradeNotice(webViewName)
            return
        }

        startPlaytimeService()
        bootServer()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) goImmersive()
    }

    override fun onDestroy() {
        startup.shutdownNow()
        mainHandler.removeCallbacksAndMessages(null)
        webView?.apply {
            stopLoading()
            loadUrl("about:blank")
            destroy()
        }
        webView = null
        if (isFinishing) {
            stopService(Intent(this, PlaytimeService::class.java))
        }
        super.onDestroy()
    }

    // ---------------------------------------------------------------- 服务

    private fun startPlaytimeService() {
        val intent = Intent(this, PlaytimeService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    /** 在后台线程启动 Go 服务，就绪后回到主线程加载 WebView。 */
    private fun bootServer() {
        startup.execute {
            try {
                val dataDir = File(filesDir, "playtime-data").apply { mkdirs() }.absolutePath
                val url = Mobile.start(dataDir)
                mainHandler.post {
                    if (!isFinishing && !isDestroyed) onServerReady(url)
                }
            } catch (error: Throwable) {
                mainHandler.post {
                    if (!isFinishing && !isDestroyed) {
                        showNotice(
                            getString(R.string.start_failed_title),
                            getString(
                                R.string.start_failed_detail,
                                error.message ?: error.javaClass.simpleName,
                            ),
                            getString(R.string.retry),
                        ) { recreate() }
                    }
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun onServerReady(url: String) {
        if (webView != null) return
        val view = WebView(this)
        view.setBackgroundColor(getColor(R.color.paper))
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        view.webViewClient = PlaytimeWebViewClient()
        // WebView 垫在提示层下面，页面加载完成后把提示层淡出。
        root.addView(
            view,
            0,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )
        webView = view
        view.loadUrl(url)
    }

    // ------------------------------------------------------------ 提示层

    private fun buildNotice() {
        notice = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(48), dp(32), dp(48), dp(32))
            setBackgroundColor(getColor(R.color.paper))
        }
        noticeTitle = TextView(this).apply {
            textSize = 26f
            setTextColor(getColor(R.color.ink))
            gravity = Gravity.CENTER
        }
        noticeDetail = TextView(this).apply {
            textSize = 16f
            setTextColor(getColor(R.color.ink_soft))
            gravity = Gravity.CENTER
            setPadding(0, dp(14), 0, dp(24))
        }
        noticeAction = Button(this).apply { visibility = View.GONE }
        notice.addView(noticeTitle)
        notice.addView(noticeDetail)
        notice.addView(noticeAction)
        root.addView(
            notice,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )
    }

    private fun showNotice(
        title: String,
        detail: String,
        actionLabel: String? = null,
        action: (() -> Unit)? = null,
    ) {
        notice.visibility = View.VISIBLE
        noticeVisible = true
        notice.alpha = 1f
        noticeTitle.text = title
        noticeDetail.text = detail
        if (actionLabel != null && action != null) {
            noticeAction.visibility = View.VISIBLE
            noticeAction.text = actionLabel
            noticeAction.setOnClickListener { action() }
        } else {
            noticeAction.visibility = View.GONE
        }
    }

    private fun hideNotice() {
        if (!noticeVisible) return
        noticeVisible = false
        notice.animate()
            .alpha(0f)
            .setDuration(180)
            .withEndAction {
                notice.visibility = View.GONE
                notice.alpha = 1f
            }
            .start()
    }

    private fun showUpgradeNotice(versionName: String) {
        showNotice(
            getString(R.string.webview_old_title),
            getString(R.string.webview_old_detail, versionName),
            getString(R.string.open_store),
        ) { openWebViewStore() }
    }

    private fun openWebViewStore() {
        val market = Intent(
            Intent.ACTION_VIEW,
            Uri.parse("market://details?id=com.google.android.webview"),
        )
        val web = Intent(
            Intent.ACTION_VIEW,
            Uri.parse("https://play.google.com/store/apps/details?id=com.google.android.webview"),
        )
        try {
            startActivity(market)
        } catch (_: Exception) {
            try {
                startActivity(web)
            } catch (_: Exception) {
                // 没有应用商店也没有浏览器时保持提示页即可。
            }
        }
    }

    // ------------------------------------------------------------ WebView

    private inner class PlaytimeWebViewClient : WebViewClient() {
        // minSdk 24 起系统只调用 WebResourceRequest 这个重载，旧版 String 重载不再需要。
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
            handleNavigation(request.url)

        override fun onPageFinished(view: WebView, url: String) {
            hideNotice()
        }

        /** 只有本机服务留在 WebView 里，外部链接交给系统浏览器或忽略。 */
        private fun handleNavigation(uri: Uri): Boolean {
            if (isLocal(uri)) return false
            try {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
            } catch (_: Exception) {
                // 打不开的系统链接不跳出课堂界面。
            }
            return true
        }
    }

    private fun isLocal(uri: Uri): Boolean {
        val host = uri.host ?: return false
        return host == "127.0.0.1" || host == "localhost" || host == "::1" || host == "[::1]"
    }

    // --------------------------------------------------------------- 返回键

    private fun handleBackPress() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    val view = webView
                    if (view != null && view.canGoBack()) {
                        view.goBack()
                        return
                    }
                    val now = System.currentTimeMillis()
                    if (now - lastBackPressAt <= EXIT_CONFIRM_WINDOW_MS) {
                        finish()
                    } else {
                        lastBackPressAt = now
                        Toast.makeText(
                            this@MainActivity,
                            R.string.exit_confirm,
                            Toast.LENGTH_SHORT,
                        ).show()
                    }
                }
            },
        )
    }

    // ------------------------------------------------------- 权限与全屏

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                NOTIFICATION_PERMISSION_REQUEST,
            )
        }
    }

    private fun goImmersive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.apply {
                hide(WindowInsets.Type.systemBars())
                systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_FULLSCREEN
                )
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
    }

    // ------------------------------------------------------- WebView 版本

    /** WebView 主版本低于 100 时返回版本名，否则返回 null。 */
    private fun oldWebViewVersionName(): String? {
        val info = currentWebViewPackage()
        val versionName = info?.versionName.orEmpty()
        val major = versionName.substringBefore('.').toIntOrNull() ?: userAgentWebViewMajor()
        if (major in 1..99) return versionName.ifEmpty { major.toString() }
        return null
    }

    private fun currentWebViewPackage(): PackageInfo? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return WebView.getCurrentWebViewPackage()
        }
        for (name in listOf("com.google.android.webview", "com.android.webview")) {
            try {
                return packageManager.getPackageInfo(name, 0)
            } catch (_: PackageManager.NameNotFoundException) {
                // 换下一个候选包名。
            }
        }
        return null
    }

    private fun userAgentWebViewMajor(): Int {
        val userAgent = try {
            WebSettings.getDefaultUserAgent(this)
        } catch (_: Exception) {
            return 0
        }
        return Regex("Chrome/(\\d+)").find(userAgent)?.groupValues?.getOrNull(1)?.toIntOrNull() ?: 0
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private companion object {
        const val EXIT_CONFIRM_WINDOW_MS = 2_000L
        const val NOTIFICATION_PERMISSION_REQUEST = 1
    }
}
