package com.duchastel.simon.mtadatavisualizer

import androidx.compose.material.MaterialTheme
import androidx.compose.runtime.*
import com.duchastel.simon.mtadatavisualizer.ui.ridershipticker.RidershipTickerScreen
import org.jetbrains.compose.ui.tooling.preview.Preview

@Composable
@Preview
fun App() {
    MaterialTheme {
        RidershipTickerScreen()
    }
}