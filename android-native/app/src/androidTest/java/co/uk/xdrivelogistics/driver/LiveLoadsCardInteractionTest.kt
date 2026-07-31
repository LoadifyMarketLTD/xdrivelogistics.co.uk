package co.uk.xdrivelogistics.driver

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import co.uk.xdrivelogistics.driver.data.DriverJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class LiveLoadsCardInteractionTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun quote_click_does_not_trigger_card_open() {
        var openCount = 0
        var quoteCount = 0
        composeRule.setContent {
            LiveLoadCard(
                job = job(id = "job-a"),
                selected = false,
                onOpen = { openCount++ },
                onQuote = { quoteCount++ },
            )
        }

        composeRule.onNodeWithText("Quote").performClick()
        composeRule.runOnIdle {
            assertEquals(0, openCount)
            assertEquals(1, quoteCount)
        }
    }

    @Test
    fun pin_hide_restore_clicks_do_not_trigger_card_open() {
        var openCount = 0
        var pinCount = 0
        var hideCount = 0
        var restoreCount = 0
        composeRule.setContent {
            LiveLoadCard(
                job = job(id = "job-a"),
                selected = false,
                onOpen = { openCount++ },
                onQuote = {},
                onSave = { pinCount++ },
                onHide = { hideCount++ },
                onRestore = { restoreCount++ },
            )
        }

        composeRule.onNodeWithText("Pin").performClick()
        composeRule.onNodeWithText("Hide").performClick()
        composeRule.runOnIdle {
            assertEquals(0, openCount)
            assertEquals(1, pinCount)
            assertEquals(1, hideCount)
            assertEquals(0, restoreCount)
        }
    }

    @Test
    fun card_body_opens_exact_tapped_job() {
        var openedJob: String? = null
        composeRule.setContent {
            LiveLoadCard(
                job = job(id = "job-b", clientName = "Northwest Freight"),
                selected = false,
                onOpen = { openedJob = "job-b" },
                onQuote = {},
            )
        }

        composeRule.onNodeWithText("Northwest Freight").performClick()
        composeRule.runOnIdle {
            assertEquals("job-b", openedJob)
        }
    }

    @Test
    fun long_and_missing_values_render_without_crashing() {
        composeRule.setContent {
            LiveLoadCard(
                job = job(
                    id = "job-long",
                    clientName = "Very Long Company Name ".repeat(8),
                    pickupLocation = "Long pickup address ".repeat(12),
                    deliveryLocation = "",
                    pickupDatetime = "",
                    deliveryDatetime = null,
                    vehicleType = "",
                    cargoType = "",
                    loadDetails = "",
                ),
                selected = false,
                onOpen = {},
                onQuote = {},
            )
        }

        composeRule.onNodeWithText("Quote").assertIsDisplayed()
        composeRule.onNodeWithText("Vehicle TBC").assertIsDisplayed()
        composeRule.onNodeWithText("Delivery location TBC").assertIsDisplayed()
    }

    private fun job(
        id: String,
        clientName: String = "Acme Freight",
        pickupLocation: String = "Leeds LS1",
        deliveryLocation: String = "Bristol BS1",
        pickupDatetime: String? = "2026-07-31T09:15:00Z",
        deliveryDatetime: String? = "2026-07-31T14:45:00Z",
        vehicleType: String = "Luton Van",
        cargoType: String = "General freight",
        loadDetails: String = """{"pallets":"2","weight":"950"}""",
    ) = DriverJob(
        id = id,
        status = "posted",
        currentStatus = "posted",
        pickupLocation = pickupLocation,
        deliveryLocation = deliveryLocation,
        pickupDatetime = pickupDatetime,
        deliveryDatetime = deliveryDatetime,
        clientName = clientName,
        clientPhone = "",
        vehicleType = vehicleType,
        cargoType = cargoType,
        budgetAmount = 120.0,
        loadDetails = loadDetails,
    )
}
