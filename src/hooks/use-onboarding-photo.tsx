import { pickReportPhoto } from '@/report/service';

export function useOnboardingPhoto() {
  return { pickPhoto: (camera = false, showFaceGuide = true) => pickReportPhoto(camera, showFaceGuide), cameraDialog: null };
}
