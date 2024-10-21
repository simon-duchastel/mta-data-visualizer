package com.duchastel.simon.mtadatavisualizer.data

import io.ktor.util.date.WeekDay
import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

object WeekDaySerializer : KSerializer<WeekDay> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("WeekDay", PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: WeekDay) {
        encoder.encodeString(value.value)
    }

    override fun deserialize(decoder: Decoder): WeekDay {
        val value = decoder.decodeString()
        return WeekDay.from(value)
    }
}