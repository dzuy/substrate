package expo.modules.substratespeech

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.interfaces.permissions.PermissionsResponseListener
import java.util.Locale

class SubstrateSpeechModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private var recognizer: SpeechRecognizer? = null
  private var pending: Promise? = null
  private var partial = ""
  private var generation = 0
  private var deadline: Runnable? = null

  override fun definition() = ModuleDefinition {
    Name("SubstrateSpeech")
    Events("state")
    AsyncFunction("start") { promise: Promise -> main.post { start(promise) } }
    Function("stop") { main.post { stop() } }
    Function("cancel") { main.post { finish("Speech input cancelled.", false) } }
    OnActivityEntersBackground { main.post { finish("Speech input stopped when the app left the foreground.") } }
    OnDestroy { main.post { finish("Speech input cancelled.", false) } }
  }
  private fun start(promise: Promise) {
    if (pending != null) { promise.reject("ERR_SPEECH", "Speech is already running.", null); return }
    pending = promise; partial = ""; val id = ++generation
    val context = appContext.reactContext
    if (context == null) { finish("Speech input is unavailable. Try again."); return }
    if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { begin(id); return }
    val permissions = appContext.permissions
    if (permissions == null) { finish("Microphone permission is unavailable."); return }
    permissions.askForPermissions(PermissionsResponseListener {
      main.post {
        if (generation == id && pending != null) {
          if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) begin(id)
          else finish("Microphone permission was denied. Enable Microphone in Settings, then retry.")
        }
      }
    }, Manifest.permission.RECORD_AUDIO)
  }
  private fun begin(id: Int) {
    val context = appContext.reactContext ?: run { finish("Speech input is unavailable."); return }
    if (!SpeechRecognizer.isRecognitionAvailable(context)) { finish("No speech service is available on this device. You can still type."); return }
    try {
      val speech = SpeechRecognizer.createSpeechRecognizer(context); recognizer = speech
      speech.setRecognitionListener(object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) { if (generation == id) sendEvent("state", mapOf("state" to "listening")) }
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() { if (generation == id) { sendEvent("state", mapOf("state" to "transcribing")); arm(8000) { finish("Transcription timed out. Try again.") } } }
        override fun onPartialResults(results: Bundle?) { if (generation == id) partial = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: partial }
        override fun onResults(results: Bundle?) { if (generation == id) { partial = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: partial; finish() } }
        override fun onError(error: Int) {
          if (generation != id) return
          finish(when (error) {
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission was denied. Enable it in Settings, then retry."
            SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech detected. Try again."
            SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Speech service could not connect. Check your connection and retry."
            else -> "Speech recognition was interrupted. Try again."
          })
        }
        override fun onEvent(eventType: Int, params: Bundle?) {}
      })
      speech.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
      })
      arm(55000) { stop() }
    } catch (_: Exception) { finish("Could not start speech recognition. Try again.") }
  }
  private fun stop() {
    if (pending == null) return
    if (recognizer == null) { finish("Speech input cancelled.", false); return }
    try { recognizer?.stopListening(); sendEvent("state", mapOf("state" to "transcribing")); arm(8000) { finish("Transcription timed out. Try again.") } }
    catch (_: Exception) { finish("Speech recognition was interrupted. Try again.") }
  }
  private fun arm(ms: Long, action: () -> Unit) {
    deadline?.let { main.removeCallbacks(it) }
    val next = Runnable { action() }; deadline = next; main.postDelayed(next, ms)
  }
  private fun finish(error: String? = null, preservePartial: Boolean = true) {
    val promise = pending ?: return
    pending = null; generation++; deadline?.let { main.removeCallbacks(it) }; deadline = null
    recognizer?.cancel(); recognizer?.destroy(); recognizer = null
    val text = partial.trim(); partial = ""
    if (text.isNotEmpty() && preservePartial) promise.resolve(mapOf("text" to text, "incomplete" to (error != null)))
    else promise.reject("ERR_SPEECH", error ?: "No speech detected. Try again.", null)
  }
}
