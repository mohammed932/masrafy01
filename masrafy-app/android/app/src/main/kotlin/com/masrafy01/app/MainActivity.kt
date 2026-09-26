package com.masrafy01.app

import android.os.Build
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "masrafy/dev_host")
            .setMethodCallHandler { call, result ->
                if (call.method == "resolve") result.success(devHost()) else result.notImplemented()
            }
    }

    /// Host the dev backend is reached at: the emulator's alias for the build
    /// machine, else the build machine's LAN address baked in by the debug
    /// build (`dev_host_ip`, absent from release builds → null).
    private fun devHost(): String? {
        if (isEmulator()) return "10.0.2.2"
        val id = resources.getIdentifier("dev_host_ip", "string", packageName)
        if (id == 0) return null
        return getString(id).ifBlank { null }
    }

    private fun isEmulator(): Boolean =
        Build.HARDWARE == "ranchu" || Build.HARDWARE == "goldfish" ||
            Build.FINGERPRINT.startsWith("generic") || Build.PRODUCT.contains("sdk")
}
