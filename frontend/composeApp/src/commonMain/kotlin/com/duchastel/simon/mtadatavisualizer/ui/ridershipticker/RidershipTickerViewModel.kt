package com.duchastel.simon.mtadatavisualizer.ui.ridershipticker

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.duchastel.simon.mtadatavisualizer.data.SubwayDataService
import io.ktor.util.date.WeekDay
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
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
        val ridershipPerSecond: Float? = null,
        val hasError: Boolean = false,
    ) {
        data class Ridership(
            val numRiders: Float
        )
    }

    init {
        fetchRidership()

        viewModelScope.launch {
            _state.collect { state ->
                if (state.ridership != null && state.ridershipPerSecond != null) {
                    delay(STATE_UPDATE_DELAY_MS)

                    // normalize to the frequency we're updating the state
                    val factor: Float = 1_000f / STATE_UPDATE_DELAY_MS
                    val newRidership = state.ridership.numRiders +
                            (state.ridershipPerSecond / factor)
                    updateState {
                        copy(
                            ridership = state.ridership.copy(
                                numRiders = newRidership
                            )
                        )
                    }
                }
            }
        }
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

                val ridershipPerSecond = ridership?.let {
                    it.ridersPerHour / 60f / 60f // riders/s = riders/hr * 60min * 60s
                }
                updateState {
                    copy(
                        dayOfWeek = ridership?.dayOfWeek,
                        ridership = ridership?.let {
                            State.Ridership(it.estimatedRidershipSoFar.toFloat())
                        },
                        ridershipPerSecond = ridershipPerSecond,
                        hasError = ridership == null,
                    )
                }
                delay(REFRESH_DELAY_MS)
            }
        }
    }

    private fun updateState(newState: State.() -> State) {
        _state.value = _state.value.newState()
    }

    companion object {
        private const val STATE_UPDATE_DELAY_MS = 100L
        private const val REFRESH_DELAY_MS = 60L * 1_000L // refresh the data every minute
    }
}
