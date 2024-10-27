package com.duchastel.simon.mtadatavisualizer.ui.ridershipticker

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.duchastel.simon.mtadatavisualizer.data.SubwayDataService
import com.duchastel.simon.mtadatavisualizer.data.SubwayDataService.StationRidership
import io.ktor.util.date.WeekDay
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.getAndUpdate
import kotlinx.coroutines.launch

class RidershipTickerViewModel(
    private val subwayDataService: SubwayDataService = SubwayDataService(),
): ViewModel() {

    // State

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state

    data class State(
        val dayOfWeek: WeekDay? = null,
        val ridership: Ridership? = null,
        val stationRidership: StationRidership? = null,
        val hasError: Boolean = false,
    ) {
        data class Ridership(
            val numRiders: Float,
            val ridershipPerSecond: Float,
        )

        data class StationRidership(
            val stations: List<Station>,
        )

        data class Station(
            val name: String,
            val numRiders: Float,
            val ridershipPerSecond: Float,
        )
    }

    init {
        fetchRidership()
        updateRidership()
    }

    // Public functions

    fun retry() {
        updateState {
            copy(ridership = null, hasError = false)
        }
        fetchRidership()
    }

    // Private functions

    /**
     * Fetch the ridership data, including refreshing ridership data on a regular interval
     */
    private fun fetchRidership() {
        viewModelScope.launch {
            while (true) {
                val ridership = subwayDataService.getTodaysRidership()
                val ridershipPerStation = subwayDataService.getTodaysRidershipTopStations(TOP_STATIONS_TO_FETCH)

                updateState {
                    copy(
                        dayOfWeek = ridership?.dayOfWeek,
                        ridership = ridership?.let {
                            // riders/s = riders/hr / 60min / 60s
                            val ridershipPerSecond = it.ridersPerHour / 60f / 60f
                            State.Ridership(
                                numRiders = it.estimatedRidershipSoFar.toFloat(),
                                ridershipPerSecond = ridershipPerSecond,
                            )
                        },
                        stationRidership = ridershipPerStation?.let { response ->
                            State.StationRidership(
                                stations = response.stations.map {
                                    // riders/s = riders/hr / 60min / 60s
                                    val ridershipPerSecond = it.ridersPerHour / 60f / 60f
                                    State.Station(
                                        name = it.name,
                                        numRiders = it.estimatedRidershipSoFar.toFloat(),
                                        ridershipPerSecond = ridershipPerSecond,
                                    )
                                }
                            )
                        },
                        hasError = ridership == null,
                    )
                }
                delay(REFRESH_DELAY_MS)
            }
        }
    }

    // Update ridership based on per second projection, or no-op if ridership
    // is uninitialized.
    private fun updateRidership() {
        viewModelScope.launch {
            while (true) {
                delay(STATE_UPDATE_DELAY_MS)

                updateState {
                    if (ridership != null) {
                        // normalize to the frequency we're updating the state
                        val factor: Float = 1_000f / STATE_UPDATE_DELAY_MS
                        val newRidership = ridership.numRiders + (ridership.ridershipPerSecond / factor)
                        copy(ridership = ridership.copy(numRiders = newRidership))
                    } else {
                        this
                    }
                }
            }
        }
    }

    private fun updateState(newState: State.() -> State) {
        _state.getAndUpdate(newState)
    }

    companion object {
        private const val TOP_STATIONS_TO_FETCH = 10
        private const val STATE_UPDATE_DELAY_MS = 100L
        private const val REFRESH_DELAY_MS = 60L * 1_000L // refresh the data every minute
    }
}
