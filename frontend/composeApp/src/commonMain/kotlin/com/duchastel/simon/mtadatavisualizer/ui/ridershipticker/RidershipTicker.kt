package com.duchastel.simon.mtadatavisualizer.ui.ridershipticker

import androidx.compose.material.Button
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import io.ktor.util.date.WeekDay

@Composable
fun RidershipTickerScreen() {
    val viewModel: RidershipTickerViewModel = viewModel { RidershipTickerViewModel() }
    val state: RidershipTickerViewModel.State by viewModel.state.collectAsState()
    val ridership = state.ridership

    when {
        ridership != null -> RidershipTicker( // success!
            dayOfWeek = ridership.dayOfWeek,
            ridership = ridership.totalRidership,
        )
        state.hasError -> Error(onRetryClicked = viewModel::retry) // error
        else -> Loading() // loading
    }
}

@Composable
private fun RidershipTicker(
    dayOfWeek: WeekDay,
    ridership: Long,
) {
    FullScreenColumnCentered {
        Text(
            text = dayOfWeek.value,
            fontSize = 48.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = ridership.toString(),
            fontSize = 48.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun Error(
    onRetryClicked: () -> Unit,
) {
    FullScreenColumnCentered {
        Text(
            text = "Error",
            fontSize = 48.sp,
            fontWeight = FontWeight.Bold,
        )
        Button(onClick = onRetryClicked) {
            Text(
                text = "Retry",
                fontSize = 48.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun Loading() {
    FullScreenColumnCentered {
        Text(text = "Loading...")
    }
}