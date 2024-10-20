package com.duchastel.simon.mtadatavisualizer.ui.ridershipticker

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.Button
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = dayOfWeek.value)
        Text(text = ridership.toString())
    }
}

@Composable
private fun Error(
    onRetryClicked: () -> Unit,
) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = "Error")
        Button(onClick = onRetryClicked) {
            Text(text = "Retry")
        }
    }
}

@Composable
private fun Loading() {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = "Loading...")
    }
}