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
import kotlinx.serialization.SerializationException

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
        return client.getAndHandleErrors<SubwayRidership>(SUBWAY_TODAY_RIDERSHIP_URL)
    }

    /**
     * Returns the current day's ridership for the top [num] stations, or null if there was an error.
     */
    suspend fun getTodaysRidershipTopStations(num: Int): SubwayRidershipPerStation? {
        val url = "$SUBWAY_TODAY_STATION_RIDERSHIP_URL?top=$num"
        return client.getAndHandleErrors<SubwayRidershipPerStation>(url)
    }

    /**
     * Makes a GET call to the provided [url] and returns the body text as a String.
     * In the case of an error, logs the issue and returns null.
     */
    private suspend inline fun <reified T> HttpClient.getAndHandleErrors(
        url: String,
        block: HttpRequestBuilder.() -> Unit = {}
    ): T? {
        return try {
            val response = get(url, block)

            if (response.status.value == HttpStatusCode.OK.value) {
                Json.decodeFromString<T>(response.bodyAsText())
            } else {
                // Log and handle non-OK status codes
                println("Error: Received status ${response.status}")
                null
            }
        } catch (e: SerializationException) {
            // Handles unexpected response
            println("Unable to serialize response: ${e.message}")
            null
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
        } catch (e: Exception) {
            // Handles miscellaneous errors
            println("Unknown error: ${e.message}")
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
        val ridersPerHour: Float,
    )

    @Serializable
    data class SubwayRidershipPerStation(
        @SerialName("day")
        @Serializable(with = WeekDaySerializer::class)
        val dayOfWeek: WeekDay,
        @SerialName("top_stations")
        val stations: List<StationRidership>,
    )

    @Serializable
    data class StationRidership(
        @SerialName("id")
        val id: String,
        @SerialName("name")
        val name: String,
        @SerialName("estimated_ridership_so_far")
        val estimatedRidershipSoFar: Int,
        @SerialName("riders_per_hour")
        val ridersPerHour: Float,
    )

    companion object {
        private const val SUBWAY_TODAY_RIDERSHIP_URL =
            "https://425c6z3r04.execute-api.us-west-2.amazonaws.com/mtasubwayridership/today"
        private const val SUBWAY_TODAY_STATION_RIDERSHIP_URL =
            "https://425c6z3r04.execute-api.us-west-2.amazonaws.com/mtasubwayridership/today/stations"
    }
}
