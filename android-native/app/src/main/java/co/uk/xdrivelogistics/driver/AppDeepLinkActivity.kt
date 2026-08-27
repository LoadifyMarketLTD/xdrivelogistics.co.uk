package co.uk.xdrivelogistics.driver

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import co.uk.xdrivelogistics.driver.data.SessionStore

class AppDeepLinkActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        route(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        route(intent)
    }

    private fun route(sourceIntent: Intent?) {
        val destination = PendingAppDestination.fromHost(sourceIntent?.data?.host)
        if (destination != null) PendingAppDestinationStore(applicationContext).save(destination)

        val target = if (SessionStore(applicationContext).readSession() == null) {
            LoginActivity::class.java
        } else {
            MainActivity::class.java
        }
        startActivity(
            Intent(this, target).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
        )
        finish()
    }
}
