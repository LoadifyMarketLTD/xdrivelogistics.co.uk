package co.uk.xdrivelogistics.driver

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import co.uk.xdrivelogistics.driver.data.SessionStore

class JobDeepLinkActivity : Activity() {
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
        val jobId = JobDeepLinkParser.extractJobId(
            jobIdExtra = sourceIntent?.getStringExtra(EXTRA_JOB_ID),
            dataUri = sourceIntent?.dataString,
            deepLinkExtra = sourceIntent?.getStringExtra(EXTRA_DEEP_LINK),
        )

        if (jobId != null) {
            PendingJobDeepLinkStore(applicationContext).save(jobId)
        }

        val destination = if (SessionStore(applicationContext).readSession() == null) {
            LoginActivity::class.java
        } else {
            MainActivity::class.java
        }
        startActivity(
            Intent(this, destination).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
        )
        finish()
    }

    companion object {
        const val ACTION_OPEN_JOB = "co.uk.xdrivelogistics.driver.OPEN_JOB"
        const val EXTRA_JOB_ID = "job_id"
        const val EXTRA_DEEP_LINK = "deep_link"
    }
}
