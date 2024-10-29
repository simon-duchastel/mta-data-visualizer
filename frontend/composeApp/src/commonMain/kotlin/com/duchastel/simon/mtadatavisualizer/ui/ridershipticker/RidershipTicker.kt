package com.duchastel.simon.mtadatavisualizer.ui.ridershipticker

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.Button
import androidx.compose.material.Icon
import androidx.compose.material.IconButton
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.duchastel.simon.mtadatavisualizer.ui.FullScreenColumnCentered
import com.duchastel.simon.mtadatavisualizer.ui.formatAsString
import com.duchastel.simon.mtadatavisualizer.ui.formatRidershipString
import com.duchastel.simon.mtadatavisualizer.ui.ridershipticker.RidershipTickerViewModel.State
import io.ktor.util.date.WeekDay
import mta_data_visualizer.composeapp.generated.resources.Res
import mta_data_visualizer.composeapp.generated.resources.dark_mode_toggle
import mta_data_visualizer.composeapp.generated.resources.error
import mta_data_visualizer.composeapp.generated.resources.loading
import mta_data_visualizer.composeapp.generated.resources.retry
import mta_data_visualizer.composeapp.generated.resources.train_enabled
import mta_data_visualizer.composeapp.generated.resources.train_disabled
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource

@Composable
fun RidershipTickerScreen() {
    val viewModel: RidershipTickerViewModel = viewModel { RidershipTickerViewModel() }
    val state: State by viewModel.state.collectAsState()
    val ridership = state.ridership
    val stationRidership = state.stationRidership
    val dayOfWeek = state.dayOfWeek

    when {
        ridership != null && stationRidership != null && dayOfWeek != null -> { // success!
            val ridershipTicker by animateIntAsState(ridership.numRiders.toInt())
            RidershipTicker(
                dayOfWeek = dayOfWeek,
                ridership = ridershipTicker,
                stationRidership = stationRidership,
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
    stationRidership: State.StationRidership,
) {
    val sortedStations = stationRidership.stations.sortedByDescending { it.numRiders }
    var showStationList by remember { mutableStateOf(false) }

    // station list button (outside of tickers box so it doesn't affect the centering
    // of the tickers)
    Row(modifier = Modifier.fillMaxWidth()) {
        Spacer(modifier = Modifier.weight(1f))
        IconButton(
            modifier = Modifier.padding(8.dp),
            onClick = { showStationList = !showStationList }
        ) {
            val icon = if (showStationList) {
                Res.drawable.train_enabled
            } else {
                Res.drawable.train_disabled
            }
            Icon(
                modifier = Modifier.size(32.dp),
                painter = painterResource(icon),
                contentDescription = stringResource(Res.string.dark_mode_toggle),
            )
        }
    }

    // tickers
    FullScreenColumnCentered {
        MainRidershipTicker(dayOfWeek, ridership)
        Spacer(modifier = Modifier.height(32.dp))
        AnimatedVisibility(visible = showStationList) {
            StationRidershipList(sortedStations)
        }
    }
}

@Composable
private fun MainRidershipTicker(dayOfWeek: WeekDay, ridership: Int) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = stringResource(formatAsString(dayOfWeek)),
            fontSize = 48.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = formatRidershipString(ridership),
            fontSize = 48.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun StationRidershipList(stationRidership: List<State.Station>) {
    LazyColumn {
        items(items = stationRidership) { station ->
            StationRidershipTicker(station)
        }
    }
}

@Composable
private fun StationRidershipTicker(station: State.Station) {
    BoxWithConstraints {
        // set the fill to 1/3 until the content gets to 600dp, at which
        // point we set the fill to whatever value reaches a size of 400
        // (not exceeding 1, since we can't fill more than 100%)
        val fill = (600f / maxWidth.value)
            .coerceAtLeast(1/3f)
            .coerceAtMost(1f)
        Row(
            modifier = Modifier
                .fillMaxWidth(fill)
                .padding(horizontal = 32.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = station.name,
                fontSize = 24.sp,
                fontWeight = FontWeight.Medium
            )

            Text(
                text = formatRidershipString(station.numRiders.toInt()),
                fontSize = 24.sp,
                fontWeight = FontWeight.Medium
            )
        }
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