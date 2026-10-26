import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Copy, Notice, ReportButton } from '@/report/ui';
import { useReportTheme } from '@/report/theme';
import { pickReportPhoto } from '@/report/service';

export function useOnboardingPhoto() {
  const [open, setOpen] = useState(false);
  const [faceGuide, setFaceGuide] = useState(true);
  const pending = useRef<((photo: string | null) => void) | null>(null);
  useEffect(() => () => { pending.current?.(null); pending.current = null; }, []);
  function finish(photo: string | null) {
    pending.current?.(photo);
    pending.current = null;
    setOpen(false);
  }
  function pickPhoto(camera = false, showFaceGuide = true): Promise<string | null> {
    if (!camera) return pickReportPhoto(false);
    if (pending.current) return Promise.resolve(null);
    return new Promise(resolve => { pending.current = resolve; setFaceGuide(showFaceGuide); setOpen(true); });
  }
  return { pickPhoto, cameraDialog: open ? <CameraDialog onFinish={finish} faceGuide={faceGuide} /> : null };
}

function CameraDialog({ onFinish, faceGuide }: { onFinish: (photo: string | null) => void; faceGuide: boolean }) {
  const { theme: t } = useReportTheme();
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [videoRatio, setVideoRatio] = useState(4 / 3);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | undefined;
    const player = video.current;
    setReady(false);
    setError('');
    async function start() {
      try {
        if (!window.isSecureContext) throw new Error('Camera access requires a secure connection. On this computer, open the app at localhost:8081. On another device, use the HTTPS site.');
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not support camera access. Try another browser or use Upload photo.');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: faceGuide ? 'user' : 'environment' }, width: { ideal: 1400 }, height: { ideal: 1050 } }, audio: false });
        if (disposed) { stream.getTracks().forEach(track => track.stop()); return; }
        if (!player) throw new Error('Unable to open the camera preview. Please try again.');
        player.srcObject = stream;
        await player.play();
      } catch (cause) {
        stream?.getTracks().forEach(track => track.stop());
        if (disposed) return;
        const name = cause instanceof Error ? cause.name : '';
        setError(name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser settings, then try again.' : name === 'NotFoundError' ? 'No camera was found. Connect a camera or use Upload photo.' : name === 'NotReadableError' ? 'The camera is unavailable. Close other apps using it, then try again.' : cause instanceof Error ? cause.message : 'Unable to start the camera. Please try again.');
      }
    }
    void start();
    return () => {
      disposed = true;
      stream?.getTracks().forEach(track => track.stop());
      if (player) player.srcObject = null;
    };
  }, [attempt, faceGuide]);

  function capture() {
    const player = video.current;
    if (!player || !ready || !player.videoWidth || !player.videoHeight) return;
    try {
      const scale = Math.min(1, 1400 / Math.max(player.videoWidth, player.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(player.videoWidth * scale);
      canvas.height = Math.round(player.videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to capture this photo. Please try again.');
      context.drawImage(player, 0, 0, canvas.width, canvas.height);
      const captured = canvas.toDataURL('image/jpeg', 0.85);
      if (captured.length > 3_700_023) throw new Error('This photo is too large. Please try again.');
      setPhoto(captured);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to capture photo.'); }
  }

  return <Modal transparent animationType="fade" onRequestClose={() => onFinish(null)}>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#00121DCC', justifyContent: 'center', padding: 16 }}>
      <ScrollView style={{ flexGrow: 0, width: '100%', maxWidth: 600, maxHeight: '100%', alignSelf: 'center', backgroundColor: t.paper, borderRadius: 24 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Copy kind="heading">Take a photo</Copy>
        <Copy kind="small">{photo ? 'Review your photo before using it.' : faceGuide ? 'Position your face clearly in the center with bright, natural lighting if possible.' : 'Center your product in the camera preview.'}</Copy>
        <div style={{ display: photo ? 'none' : 'block', position: 'relative', width: `min(100%, ${50 * videoRatio}vh)`, margin: '0 auto', borderRadius: 12, overflow: 'hidden', background: '#031927' }}>
          <video ref={video} autoPlay muted playsInline aria-label="Live camera preview" onCanPlay={() => { if (video.current?.videoWidth && video.current.videoHeight) setVideoRatio(video.current.videoWidth / video.current.videoHeight); setReady(true); }} style={{ display: 'block', width: '100%', height: 'auto', transform: faceGuide ? 'scaleX(-1)' : undefined }} />
          {faceGuide && ready && !error ? <div aria-hidden="true" style={{ pointerEvents: 'none', position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', height: '82%', aspectRatio: '0.72', maxWidth: '85%', border: '2px solid #F3D3A7', borderRadius: '50%', boxSizing: 'border-box', boxShadow: '0 0 0 100vmax rgba(0, 18, 29, 0.42)' }} />
          </div> : null}
        </div>
        {photo ? <img src={photo} alt="Captured photo preview" style={{ width: '100%', maxHeight: '50vh', objectFit: 'contain', borderRadius: 12 }} /> : null}
        {error ? <Notice>{error}</Notice> : null}
        {photo ? <View style={{ gap: 12 }}>
          <ReportButton label="Use photo" onPress={() => onFinish(photo)} />
          <ReportButton secondary label="Retake" onPress={() => { setPhoto(null); setError(''); }} />
        </View> : error ? <ReportButton secondary label="Try camera again" onPress={() => setAttempt(value => value + 1)} /> : <ReportButton label={ready ? 'Capture photo' : 'Waiting for camera…'} disabled={!ready} onPress={capture} />}
        <ReportButton secondary label="Cancel" onPress={() => onFinish(null)} />
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
