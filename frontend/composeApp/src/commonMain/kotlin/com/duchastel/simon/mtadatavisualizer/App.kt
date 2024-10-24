package com.duchastel.simon.mtadatavisualizer

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.Icon
import androidx.compose.material.IconButton
import androidx.compose.material.Scaffold
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.duchastel.simon.mtadatavisualizer.ui.AppTheme
import com.duchastel.simon.mtadatavisualizer.ui.ridershipticker.RidershipTickerScreen
import mta_data_visualizer.composeapp.generated.resources.Res
import mta_data_visualizer.composeapp.generated.resources.dark_mode_icon
import mta_data_visualizer.composeapp.generated.resources.dark_mode_toggle
import mta_data_visualizer.composeapp.generated.resources.light_mode_icon
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource
import org.jetbrains.compose.ui.tooling.preview.Preview

@Composable
@Preview
fun App() {
    var darkModeOverride: Boolean? by remember { mutableStateOf(null) }
    val currentThemeIsDarkMode = darkModeOverride ?: isSystemInDarkTheme()

    AppTheme(darkTheme = currentThemeIsDarkMode) {
        Scaffold {
            IconButton(
                modifier = Modifier.padding(8.dp),
                onClick = { darkModeOverride = !currentThemeIsDarkMode }
            ) {
                val icon = if (currentThemeIsDarkMode) {
                    painterResource(Res.drawable.light_mode_icon)
                } else {
                    painterResource(Res.drawable.dark_mode_icon)
                }
                Icon(
                    modifier = Modifier.size(48.dp),
                    painter = icon,
                    contentDescription = stringResource(Res.string.dark_mode_toggle),
                )
            }
            RidershipTickerScreen()
        }
    }
}