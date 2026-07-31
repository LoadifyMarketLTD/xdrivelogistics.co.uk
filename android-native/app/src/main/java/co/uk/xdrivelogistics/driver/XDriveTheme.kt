package co.uk.xdrivelogistics.driver

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Single source of truth for all XDrive design tokens.
 *
 * Reference this object from every Compose screen in the package.
 * Do not re-declare colour constants in individual files — add aliases
 * here and point local private vals at [XDriveTheme].
 */
internal object XDriveTheme {

    // ── Brand colours ────────────────────────────────────────────────────────────
    /**
     * Brand navy — primary accent used for buttons, route-marker blobs, badges,
     * and interactive state highlights.  Replaces ad-hoc blue references.
     */
    val Navy: Color = Color(0xFF0B2F6B)

    /** Page/scaffold background — near-black with a navy tint. */
    val Background: Color = Color(0xFF070B14)

    /**
     * Canvas — bottom navigation bar background and secondary containers
     * that sit one elevation step above the page background.
     */
    val Canvas: Color = Color(0xFF0D1424)

    /** Surface — card and panel background. */
    val Surface: Color = Color(0xFF131D33)

    /** Border — stroke and separator lines. */
    val Border: Color = Color(0xFF24324D)

    /** Chip — inline pill / filter chip background. */
    val Chip: Color = Color(0xFF1C2947)

    // ── Accent ───────────────────────────────────────────────────────────────────
    /** XDrive yellow — primary CTA colour, icon accent, and active-state highlight. */
    val Yellow: Color = Color(0xFFFFD200)

    // ── Semantic ─────────────────────────────────────────────────────────────────
    /** Success / active / pickup marker green. */
    val Success: Color = Color(0xFF25D987)

    /** Danger / error / delivery marker red. */
    val Danger: Color = Color(0xFFFF5C7A)

    // ── Text ─────────────────────────────────────────────────────────────────────
    /** High-emphasis body and heading text on dark surfaces. */
    val TextPrimary: Color = Color(0xFFF8FAFC)

    /** Low-emphasis secondary labels, metadata and helper text. */
    val TextSecondary: Color = Color(0xFFA9B7D0)

    // ── Layout / spacing ─────────────────────────────────────────────────────────
    /** Standard horizontal padding for full-width screen LazyColumns and Columns. */
    val ScreenPaddingHorizontal: Dp = 18.dp

    /** Corner radius for card-shaped surfaces. */
    val CardRadius: Dp = 18.dp

    /** Internal padding for card content. */
    val CardPadding: Dp = 16.dp

    /** Vertical spacing between items in a scrolling list. */
    val ItemSpacing: Dp = 14.dp

    /**
     * Minimum tappable height for bottom-navigation items.
     * Material Design recommends a 48 dp minimum; 56 dp gives comfortable touch
     * targets on phones with small display densities.
     */
    val BottomNavItemMinHeight: Dp = 56.dp
}
