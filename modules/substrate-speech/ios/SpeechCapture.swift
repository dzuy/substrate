import Foundation
import AVFoundation
import Speech

// Kept separate from the Expo bridge so the platform implementation can be typechecked independently.
final class SpeechCapture {
  var onState: ((String) -> Void)?
  private var engine: AVAudioEngine?
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var recognizer: SFSpeechRecognizer?
  private var completion: ((Result<(String, Bool), Error>) -> Void)?
  private var deadline: DispatchWorkItem?
  private var generation = UUID()
  private var partial = ""
  private var hasTap = false

  func start(_ completion: @escaping (Result<(String, Bool), Error>) -> Void) {
    guard self.completion == nil else { completion(.failure(failure("Speech is already running."))); return }
    self.completion = completion
    partial = ""
    let id = UUID(); generation = id
    SFSpeechRecognizer.requestAuthorization { status in
      DispatchQueue.main.async {
        guard self.generation == id else { return }
        guard status == .authorized else { self.finish(error: self.failure("Speech permission was denied. Enable Speech Recognition in Settings, then retry.")); return }
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
          DispatchQueue.main.async {
            guard self.generation == id else { return }
            guard granted else { self.finish(error: self.failure("Microphone permission was denied. Enable Microphone in Settings, then retry.")); return }
            self.begin(id)
          }
        }
      }
    }
  }

  private func begin(_ id: UUID) {
    let recognizer = SFSpeechRecognizer(locale: Locale.current)
    guard let recognizer = recognizer, recognizer.isAvailable else {
      finish(error: failure("Speech recognition is unavailable for this language or connection. Try again.")); return
    }
    self.recognizer = recognizer
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.record, mode: .measurement, options: .duckOthers)
      try session.setActive(true, options: .notifyOthersOnDeactivation)
      let engine = AVAudioEngine(); self.engine = engine
      let request = SFSpeechAudioBufferRecognitionRequest(); self.request = request
      request.shouldReportPartialResults = true
      let input = engine.inputNode
      let format = input.outputFormat(forBus: 0)
      guard format.sampleRate > 0, format.channelCount > 0 else { throw failure("No microphone is available. Try again.") }
      input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in request.append(buffer) }
      hasTap = true
      task = recognizer.recognitionTask(with: request) { result, error in
        DispatchQueue.main.async {
          guard self.generation == id, self.completion != nil else { return }
          if let result = result { self.partial = result.bestTranscription.formattedString }
          if result?.isFinal == true { self.finish(); return }
          if error != nil { self.finish(error: self.failure("Speech recognition was interrupted. Try again.")) }
        }
      }
      engine.prepare(); try engine.start()
      onState?("listening")
      armDeadline(seconds: 55) { self.stop() }
    } catch { finish(error: error) }
  }

  func stop() {
    guard completion != nil else { return }
    // A second tap while permission is pending cancels that pending start.
    guard request != nil else { cancel(); return }
    stopAudio(); request?.endAudio(); onState?("transcribing")
    armDeadline(seconds: 8) { self.finish(error: self.failure("Transcription timed out. Try again.")) }
  }
  func cancel() { finish(error: failure("Speech input cancelled."), preservePartial: false) }
  func interrupt() { finish(error: failure("Speech input stopped when the app left the foreground.")) }

  private func armDeadline(seconds: Double, action: @escaping () -> Void) {
    deadline?.cancel()
    let work = DispatchWorkItem(block: action); deadline = work
    DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
  }
  private func stopAudio() {
    engine?.stop()
    if hasTap { engine?.inputNode.removeTap(onBus: 0); hasTap = false }
  }
  private func finish(error: Error? = nil, preservePartial: Bool = true) {
    guard let done = completion else { return }
    completion = nil; generation = UUID(); deadline?.cancel(); deadline = nil
    stopAudio(); request?.endAudio(); task?.cancel()
    engine = nil; request = nil; task = nil; recognizer = nil
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    let text = partial.trimmingCharacters(in: .whitespacesAndNewlines); partial = ""
    if !text.isEmpty && preservePartial { done(.success((text, error != nil))) }
    else { done(.failure(error ?? failure("No speech detected. Try again."))) }
  }
  private func failure(_ message: String) -> NSError { NSError(domain: "SubstrateSpeech", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}
