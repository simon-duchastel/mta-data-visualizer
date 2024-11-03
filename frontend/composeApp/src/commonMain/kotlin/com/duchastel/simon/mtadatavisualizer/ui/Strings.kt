package com.duchastel.simon.mtadatavisualizer.ui

import io.ktor.util.date.WeekDay
import mta_data_visualizer.composeapp.generated.resources.Res
import mta_data_visualizer.composeapp.generated.resources.friday_short
import mta_data_visualizer.composeapp.generated.resources.monday_short
import mta_data_visualizer.composeapp.generated.resources.saturday_short
import mta_data_visualizer.composeapp.generated.resources.sunday_short
import mta_data_visualizer.composeapp.generated.resources.thursday_short
import mta_data_visualizer.composeapp.generated.resources.tuesday_short
import mta_data_visualizer.composeapp.generated.resources.wednesday_short
import org.jetbrains.compose.resources.StringResource

fun formatAsString(weekDay: WeekDay): StringResource {
    return when (weekDay) {
        WeekDay.MONDAY -> Res.string.monday_short
        WeekDay.TUESDAY -> Res.string.tuesday_short
        WeekDay.WEDNESDAY -> Res.string.wednesday_short
        WeekDay.THURSDAY -> Res.string.thursday_short
        WeekDay.FRIDAY -> Res.string.friday_short
        WeekDay.SATURDAY -> Res.string.saturday_short
        WeekDay.SUNDAY -> Res.string.sunday_short
    }
}

fun formatRidershipString(ridership: Int): String {
    return ridership.toString()
        .reversed()
        .chunked(3)
        .joinToString(",")
        .reversed()
}
