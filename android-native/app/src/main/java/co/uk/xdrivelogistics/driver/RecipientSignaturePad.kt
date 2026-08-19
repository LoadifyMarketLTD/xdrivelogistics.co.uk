package co.uk.xdrivelogistics.driver

import android.graphics.Bitmap
import android.graphics.Paint
import android.util.Base64
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.StrokeCap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import java.io.ByteArrayOutputStream

@Composable
fun RecipientSignaturePad(
    signatureData: String,
    onSignatureChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var strokes by remember { mutableStateOf<List<List<Offset>>>(emptyList()) }
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }

    val emitSignature = {
        if (strokes.any { it.size >= 2 } && canvasSize.width > 0 && canvasSize.height > 0) {
            onSignatureChange(renderSignatureDataUrl(strokes, canvasSize))
        }
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = if (signatureData.isBlank()) "Recipient signature" else "Recipient signature captured",
            color = if (signatureData.isBlank()) XDriveTheme.TextSecondary else XDriveTheme.Success,
        )
        Spacer(Modifier.height(8.dp))
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp)
                .background(Color.White, RoundedCornerShape(12.dp))
                .border(1.dp, XDriveTheme.Border, RoundedCornerShape(12.dp))
                .padding(8.dp)
                .onSizeChanged { canvasSize = it }
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragStart = { start ->
                            strokes = strokes + listOf(listOf(start))
                            onSignatureChange("")
                        },
                        onDrag = { change, _ ->
                            val current = strokes.lastOrNull().orEmpty()
                            if (current.isNotEmpty()) {
                                strokes = strokes.dropLast(1) + listOf(current + change.position)
                            }
                        },
                        onDragEnd = emitSignature,
                        onDragCancel = emitSignature,
                    )
                },
        ) {
            strokes.forEach { stroke ->
                stroke.zipWithNext().forEach { (from, to) ->
                    drawLine(
                        color = Color.Black,
                        start = from,
                        end = to,
                        strokeWidth = 4f,
                        cap = StrokeCap.Round,
                    )
                }
            }
        }
        TextButton(
            onClick = {
                strokes = emptyList()
                onSignatureChange("")
            },
        ) {
            Text("Clear signature", color = XDriveTheme.TextSecondary)
        }
    }
}

private fun renderSignatureDataUrl(
    strokes: List<List<Offset>>,
    size: IntSize,
): String {
    val width = size.width.coerceAtLeast(1)
    val height = size.height.coerceAtLeast(1)
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = android.graphics.Canvas(bitmap)
    canvas.drawColor(android.graphics.Color.WHITE)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.BLACK
        strokeWidth = 4f
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    strokes.forEach { stroke ->
        stroke.zipWithNext().forEach { (from, to) ->
            canvas.drawLine(from.x, from.y, to.x, to.y, paint)
        }
    }

    return ByteArrayOutputStream().use { output ->
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
        "data:image/png;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
    }
}
