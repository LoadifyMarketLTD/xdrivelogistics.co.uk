package co.uk.xdrivelogistics.driver

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PendingLocationStoreInstrumentedTest {
    @Test
    fun encryptedStorePersistsNewestLocationAndClears() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val store = PendingLocationStore(context)
        store.clear()

        val first = PendingLocation(53.748, -2.482, 100L)
        val newest = PendingLocation(53.750, -2.480, 200L)
        store.save(first)
        store.save(newest)

        assertEquals(newest, store.read())
        store.clear()
        assertNull(store.read())
    }
}
