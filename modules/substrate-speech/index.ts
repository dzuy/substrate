import { requireOptionalNativeModule } from 'expo';
export type SpeechResult = { text: string; incomplete: boolean };
type SpeechEvents = { state: (event: { state: 'listening' | 'transcribing' }) => void };
export default requireOptionalNativeModule<{
  addListener(event: 'state', listener: SpeechEvents['state']): { remove(): void };
  start(): Promise<SpeechResult>;
  stop(): void;
  cancel(): void;
}>('SubstrateSpeech');
