package co.uk.xdrivelogistics.driver

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class JobDeepLinkParserTest {
    @Test
    fun `job id extra wins for background FCM notification tap`() {
        assertEquals(
            "11111111-2222-3333-4444-555555555555",
            JobDeepLinkParser.extractJobId(
                jobIdExtra = "11111111-2222-3333-4444-555555555555",
                dataUri = null,
                deepLinkExtra = null,
            ),
        )
    }

    @Test
    fun `custom scheme routes foreground notification tap`() {
        assertEquals(
            "job-123",
            JobDeepLinkParser.extractJobId(
                jobIdExtra = null,
                dataUri = "xdrive://job/job-123",
                deepLinkExtra = null,
            ),
        )
    }

    @Test
    fun `verified https job link routes to native job`() {
        assertEquals(
            "job-456",
            JobDeepLinkParser.extractJobId(
                jobIdExtra = null,
                dataUri = "https://www.xdrivelogistics.co.uk/driver/jobs/job-456",
                deepLinkExtra = null,
            ),
        )
    }

    @Test
    fun `deep link data fallback is supported`() {
        assertEquals(
            "job-789",
            JobDeepLinkParser.extractJobId(
                jobIdExtra = null,
                dataUri = null,
                deepLinkExtra = "xdrive://job/job-789",
            ),
        )
    }

    @Test
    fun `untrusted hosts and malformed job ids fail closed`() {
        assertNull(JobDeepLinkParser.extractJobId(null, "https://example.com/driver/jobs/job-1", null))
        assertNull(JobDeepLinkParser.extractJobId("../other-job", null, null))
    }
}
