package co.uk.xdrivelogistics.driver

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class FirebaseBootstrapTest {
    @Test
    fun `buildFirebaseOptionsOrNull returns null when config incomplete`() {
        val options = buildFirebaseOptionsOrNull(
            FirebaseRuntimeConfig(
                projectId = "project-id",
                applicationId = "",
                apiKey = "api-key",
                senderId = "1234567890",
            ),
        )

        assertNull(options)
    }

    @Test
    fun `buildFirebaseOptionsOrNull builds options when config complete`() {
        val options = buildFirebaseOptionsOrNull(
            FirebaseRuntimeConfig(
                projectId = "project-id",
                applicationId = "1:1234567890:android:abcdef",
                apiKey = "api-key",
                senderId = "1234567890",
            ),
        )

        assertNotNull(options)
        assertEquals("project-id", options?.projectId)
        assertEquals("1:1234567890:android:abcdef", options?.applicationId)
        assertEquals("api-key", options?.apiKey)
        assertEquals("1234567890", options?.gcmSenderId)
    }

    @Test
    fun `firebaseRuntimeConfigFromBuildConfig trims values`() {
        val config = firebaseRuntimeConfigFromBuildConfig(
            projectId = " project-id ",
            applicationId = " app-id ",
            apiKey = " api-key ",
            senderId = " 123 ",
        )

        assertEquals("project-id", config.projectId)
        assertEquals("app-id", config.applicationId)
        assertEquals("api-key", config.apiKey)
        assertEquals("123", config.senderId)
    }
}
