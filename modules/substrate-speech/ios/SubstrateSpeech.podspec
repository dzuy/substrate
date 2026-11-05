Pod::Spec.new do |s|
  s.name = 'SubstrateSpeech'
  s.version = '1.0.0'
  s.summary = 'In-app speech input for Substrate'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Substrate'
  s.homepage = 'https://github.com/dzuy/substrate'
  s.source = { :git => 'https://github.com/dzuy/substrate.git' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Speech', 'AVFoundation'
  s.source_files = '**/*.swift'
end
