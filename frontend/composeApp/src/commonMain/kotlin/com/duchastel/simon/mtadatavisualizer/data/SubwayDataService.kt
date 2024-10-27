package com.duchastel.simon.mtadatavisualizer.data

import io.ktor.client.HttpClient
import io.ktor.client.plugins.*
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.get
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import io.ktor.util.date.WeekDay
import kotlinx.serialization.SerialName

class SubwayDataService(
    private val client: HttpClient = HttpClient {
        install(HttpTimeout) {
            requestTimeoutMillis = 10_000
        }
    }
) {
    /**
     * Returns the current day's ridership, or null if there was an error.
     */
    suspend fun getTodaysRidership(): SubwayRidership? {
        val responseBody = client.getAndHandleErrors(SUBWAY_TODAY_RIDERSHIP_URL) ?: return null
        return Json.decodeFromString<SubwayRidership>(responseBody)
    }

    /**
     * Returns the current day's ridership for the top [num] stations, or null if there was an error.
     */
    suspend fun getTodaysRidershipTopStations(num: Int): SubwayRidershipPerStation? {
        val url = "$SUBWAY_TODAY_STATION_RIDERSHIP_URL?top=$num"
        val responseBody = client.getAndHandleErrors(url) ?: return null
        return Json.decodeFromString<SubwayRidershipPerStation>(responseBody)
    }

    /**
     * Makes a GET call to the provided [url] and returns the body text as a String.
     * In the case of an error, logs the issue and returns null.
     */
    private suspend fun HttpClient.getAndHandleErrors(
        url: String,
        block: HttpRequestBuilder.() -> Unit = {}
    ): String? {
        return try {
            val response = get(url, block)

            if (response.status.value == HttpStatusCode.OK.value) {
                response.bodyAsText()
            } else {
                // Log and handle non-OK status codes
                println("Error: Received status ${response.status}")
                null
            }
        } catch (e: ClientRequestException) {
            // Handles 4xx errors
            println("Client error (${e.response.status}): ${e.message}")
            null
        } catch (e: ServerResponseException) {
            // Handles 5xx errors
            println("Server error (${e.response.status}): ${e.message}")
            null
        } catch (e: HttpRequestTimeoutException) {
            // Handles timeouts
            println("Connection timed out: ${e.message}")
            null
        }
    }

    @Serializable
    data class SubwayRidership(
        @SerialName("day")
        @Serializable(with = WeekDaySerializer::class)
        val dayOfWeek: WeekDay,
        @SerialName("estimated_ridership_today")
        val estimatedRidershipToday: Int,
        @SerialName("estimated_ridership_so_far")
        val estimatedRidershipSoFar: Int,
        @SerialName("riders_per_hour")
        val ridersPerHour: Int,
    )

    @Serializable
    data class SubwayRidershipPerStation(
        @SerialName("day")
        @Serializable(with = WeekDaySerializer::class)
        val dayOfWeek: WeekDay,
        @SerialName("stations")
        val stations: List<StationRidership>,
    )

    @Serializable
    data class StationRidership(
        @SerialName("complex_id")
        val id: String,
        @SerialName("complex_name")
        val name: String,
        @SerialName("estimated_ridership_today")
        val estimatedRidershipToday: Int,
        @SerialName("estimated_ridership_so_far")
        val estimatedRidershipSoFar: Int,
        @SerialName("riders_per_hour")
        val ridersPerHour: Int,
    )

    companion object {
        private const val SUBWAY_TODAY_RIDERSHIP_URL =
            "https://425c6z3r04.execute-api.us-west-2.amazonaws.com/mtasubwayridership/today"
        private const val SUBWAY_TODAY_STATION_RIDERSHIP_URL =
            "https://425c6z3r04.execute-api.us-west-2.amazonaws.com/mtasubwayridership/today/station"
    }
}
