package com.duchastel.simon.mtadatavisualizer.ui.ridershipticker

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.duchastel.simon.mtadatavisualizer.data.SubwayDataService
import com.duchastel.simon.mtadatavisualizer.data.SubwayDataService.SubwayRidership
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
        val ridership: SubwayRidership? = null,
        val ridershipPerSecond: Float? = null,
        val hasError: Boolean = false,
    )

    init {
        fetchRidership()

        viewModelScope.launch {
            _state.collect { state ->
                if (state.ridership != null && state.ridershipPerSecond != null) {
                    delay(STATE_UPDATE_DELAY_MS)

                    // normalize to the frequency we're updating the state
                    val factor: Float = 1_000f / STATE_UPDATE_DELAY_MS
                    val newRidership = state.ridership.estimatedRidershipSoFar +
                            (state.ridershipPerSecond / factor).toInt()
                    updateState {
                        copy(
                            ridership = state.ridership.copy(
                                estimatedRidershipSoFar = newRidership
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

    private fun fetchRidership() {
        viewModelScope.launch {
            val ridership = subwayDataService.getTodaysRidership()

            val ridershipPerSecond = ridership?.let {
                it.estimatedRidershipToday / 24f / 60f / 60f
            }
            updateState {
                copy(
                    ridership = ridership,
                    ridershipPerSecond = ridershipPerSecond,
                    hasError = ridership == null,
                )
            }
        }
    }

    private fun updateState(newState: State.() -> State) {
        _state.value = _state.value.newState()
    }

    companion object {
        private const val STATE_UPDATE_DELAY_MS = 100L
    }
}
