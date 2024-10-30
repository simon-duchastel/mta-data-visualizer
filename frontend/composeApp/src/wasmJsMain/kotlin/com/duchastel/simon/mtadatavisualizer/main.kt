package com.duchastel.simon.mtadatavisualizer

import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.window.ComposeViewport
import kotlinx.browser.document

@OptIn(ExperimentalComposeUiApi::class)
fun main() {
    ComposeViewport(document.body!!) {
        // by default make everything selectable on web
        SelectionContainer {
            App()
        }
    }
}