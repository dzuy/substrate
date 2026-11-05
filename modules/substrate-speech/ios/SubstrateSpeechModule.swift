import ExpoModulesCore

public class SubstrateSpeechModule: Module {
  private let capture = SpeechCapture()
  public func definition() -> ModuleDefinition {
    Name("SubstrateSpeech")
    Events("state")
    OnCreate { self.capture.onState = { state in self.sendEvent("state", ["state": state]) } }
    AsyncFunction("start") { (promise: Promise) in
      self.capture.start { result in
        switch result {
        case .success(let value): promise.resolve(["text": value.0, "incomplete": value.1])
        case .failure(let error): promise.reject("ERR_SPEECH", error.localizedDescription)
        }
      }
    }.runOnQueue(.main)
    Function("stop") { DispatchQueue.main.async { self.capture.stop() } }
    Function("cancel") { DispatchQueue.main.async { self.capture.cancel() } }
    OnAppEntersBackground { DispatchQueue.main.async { self.capture.interrupt() } }
    OnDestroy { DispatchQueue.main.async { self.capture.cancel() } }
  }
}
