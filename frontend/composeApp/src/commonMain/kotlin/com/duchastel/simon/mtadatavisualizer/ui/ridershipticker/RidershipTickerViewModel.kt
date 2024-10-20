package com.duchastel.simon.mtadatavisualizer.ui.ridershipticker

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.duchastel.simon.mtadatavisualizer.data.SubwayDataService
import com.duchastel.simon.mtadatavisualizer.data.SubwayDataService.SubwayRidership
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
        val hasError: Boolean = false
    )

    init {
        fetchRidership()
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
            updateState {
                copy(ridership = ridership, hasError = ridership == null)
            }
        }
    }

    private fun updateState(newState: State.() -> State) {
        _state.value = _state.value.newState()
    }
}
