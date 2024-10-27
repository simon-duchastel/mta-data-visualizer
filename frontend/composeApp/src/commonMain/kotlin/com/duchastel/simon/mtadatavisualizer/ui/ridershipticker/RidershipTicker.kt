package com.duchastel.simon.mtadatavisualizer.ui.ridershipticker

import androidx.compose.animation.core.animateIntAsState
import androidx.compose.material.Button
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.duchastel.simon.mtadatavisualizer.ui.FullScreenColumnCentered
import com.duchastel.simon.mtadatavisualizer.ui.formatAsString
import com.duchastel.simon.mtadatavisualizer.ui.formatRidershipString
import io.ktor.util.date.WeekDay
import mta_data_visualizer.composeapp.generated.resources.Res
import mta_data_visualizer.composeapp.generated.resources.error
import mta_data_visualizer.composeapp.generated.resources.loading
import mta_data_visualizer.composeapp.generated.resources.retry
import org.jetbrains.compose.resources.stringResource

@Composable
fun RidershipTickerScreen() {
    val viewModel: RidershipTickerViewModel = viewModel { RidershipTickerViewModel() }
    val state: RidershipTickerViewModel.State by viewModel.state.collectAsState()
    val ridership = state.ridership
    val dayOfWeek = state.dayOfWeek

    when {
        ridership != null && dayOfWeek != null -> { // success!
            val ridershipTicker by animateIntAsState(ridership.numRiders.toInt())
            RidershipTicker(
                dayOfWeek = dayOfWeek,
                ridership = ridershipTicker,
            )
        }
        state.hasError -> Error(onRetryClicked = viewModel::retry) // error
        else -> Loading() // loading
    }
}

@Composable
private fun RidershipTicker(
    dayOfWeek: WeekDay,
    ridership: Int,
) {
    FullScreenColumnCentered {
        Text(
            text = stringResource(formatAsString(dayOfWeek)),
            fontSize = 48.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = formatRidershipString(ridership),
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
            text = stringResource(Res.string.error),
            fontSize = 48.sp,
            fontWeight = FontWeight.Bold,
        )
        Button(onClick = onRetryClicked) {
            Text(
                text = stringResource(Res.string.retry),
                fontSize = 48.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun Loading() {
    FullScreenColumnCentered {
        Text(text = stringResource(Res.string.loading))
    }
}