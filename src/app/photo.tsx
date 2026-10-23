import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ArrowLeft, Camera, Sun, ScanFace, Check } from 'lucide-react-native';
import { Copy, Notice, Panel, ReportButton, ReportFrame } from '@/report/ui';
import { useReportTheme } from '@/report/theme';
import { useAuth } from '@/lib/auth-context';
import { formatDisplayDate, getActiveEntryDate, getOrCreateDailyEntry } from '@/services/daily-entries';
import { analyzeDailyPhoto, getLatestDailyPhoto, toPhotoAnalysis, uploadDailyPhoto } from '@/services/photos';
import type { PhotoAnalysis } from '@/types/database';

export default function PhotoScreen() {
  const router = useRouter();
  const { theme: t } = useReportTheme();
  const { user } = useAuth();
  const [entryId, setEntryId] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [photoAnalysis, setPhotoAnalysis] = useState<PhotoAnalysis | null>(null);
  const [entryDate, setEntryDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadPhotoState() {
        if (!user) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setErrorMessage('');

        const activeDate = await getActiveEntryDate(user.id);
        const entry = await getOrCreateDailyEntry(user.id, activeDate);

        if (!isMounted) {
          return;
        }

        if (entry.error || !entry.data) {
          setErrorMessage(entry.error?.message ?? "Couldn't load today's entry.");
          setIsLoading(false);
          return;
        }

        setEntryId(entry.data.id);
        setEntryDate(activeDate);

        const photo = await getLatestDailyPhoto(entry.data.id);

        if (!isMounted) {
          return;
        }

        if (photo.error) {
          setErrorMessage(photo.error.message);
          setIsLoading(false);
          return;
        }

        setPhotoUri(photo.data?.signedUrl ?? null);

        const loadedAnalysis = toPhotoAnalysis(photo.data?.photo.quality_checks);
        setPhotoAnalysis(loadedAnalysis ?? null);
        setStatusMessage(photo.data ? 'Loaded today’s saved photo.' : '');
        setIsLoading(false);

        if (photo.data?.photo.id && !loadedAnalysis?.analyzedAt) {
          setIsAnalyzing(true);
          const analyzed = await analyzeDailyPhoto(photo.data.photo.id);

          if (!isMounted) {
            return;
          }

          setIsAnalyzing(false);

          if (analyzed.data) {
            setPhotoAnalysis(analyzed.data);
            setStatusMessage('Loaded and analyzed today’s saved photo.');
          }
        }
      }

      loadPhotoState();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  async function capturePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      setErrorMessage('Camera permission is required to take your daily photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
      base64: true,
    });

    await handlePickerResult(result);
  }

  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
      base64: true,
    });

    await handlePickerResult(result);
  }

  async function handlePickerResult(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) {
      return;
    }

    if (!entryId || !user) {
      setErrorMessage('Daily entry is not ready yet. Try again in a moment.');
      return;
    }

    const image = result.assets[0];
    setPhotoUri(image.uri);
    setIsUploading(true);
    setPhotoAnalysis(null);
    setErrorMessage('');
    setStatusMessage('Uploading photo to your private entry.');

    const upload = await uploadDailyPhoto({
      userId: user.id,
      dailyEntryId: entryId,
      image,
    });

    setIsUploading(false);

    if (upload.error) {
      setErrorMessage(upload.error.message);
      setStatusMessage('');
      return;
    }

    const savedPhoto = await getLatestDailyPhoto(entryId);

    if (savedPhoto.data?.signedUrl) {
      setPhotoUri(savedPhoto.data.signedUrl);
    }

    setStatusMessage('Photo saved. Running basic image analysis.');

    if (upload.data?.id) {
      setIsAnalyzing(true);
      const analyzed = await analyzeDailyPhoto(upload.data.id);
      setIsAnalyzing(false);

      if (analyzed.data) {
        setPhotoAnalysis(analyzed.data);
        setStatusMessage('Photo saved and analyzed.');
      } else {
        setStatusMessage('Photo saved. Your skin insights will update when analysis is available.');
      }
    } else {
      setStatusMessage('Photo saved.');
    }
  }

  const hasPhoto = Boolean(photoUri);
  const isBusy = isLoading || isUploading || isAnalyzing;
  return <ReportFrame compact dark footer={false} showStyleGuide={false}>
    <View style={{width:'100%',maxWidth:390,alignSelf:'center',gap:14}}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Your Day" onPress={()=>router.replace('/your-day')} style={{flexDirection:'row',gap:7,alignItems:'center',minHeight:44}}><ArrowLeft size={18} color={t.paper}/><Copy kind="small">Your Day</Copy></Pressable>
      <View style={{gap:7,paddingHorizontal:8}}><Copy kind="title">Your daily photo</Copy><Copy kind="small" style={{color:'#D2DCE1'}}>A moment for your skin. Track its changes over time.</Copy>{entryDate?<Copy kind="small" style={{color:t.gold}}>{formatDisplayDate(entryDate)}</Copy>:null}</View>
      <Panel style={{padding:10,borderRadius:22,gap:14}}>
        <View style={{height:300,borderRadius:16,overflow:'hidden',backgroundColor:'#E5DFD3'}}>
          <Image source={photoUri?{uri:photoUri}:require('@/assets/images/daily-photo-example-front-v1.png')} accessibilityLabel={photoUri?'Your daily skin photo':'Example: face forward with eyes open and hair pulled back'} contentFit={photoUri?"cover":"contain"} style={{width:'100%',height:'100%'}}/>

          {isBusy?<View style={{position:'absolute',inset:0,backgroundColor:'#03172399',alignItems:'center',justifyContent:'center',gap:12}}><ActivityIndicator color={t.gold}/><Copy style={{color:t.paper}}>{isUploading?'Saving your photo…':isAnalyzing?'Reading your skin…':'Loading your photo…'}</Copy></View>:null}
        </View>
        {!hasPhoto?<Copy kind="small" style={{color:t.muted,textAlign:'center'}}>Example · Face forward, eyes open, hair off your face.</Copy>:null}
        {errorMessage?<Notice>{errorMessage}</Notice>:statusMessage?<View style={{flexDirection:'row',gap:8,alignItems:'center',paddingHorizontal:6}}><Check size={16} color={t.gold}/><Copy kind="small" style={{color:t.muted,flex:1}}>{statusMessage}</Copy></View>:null}
        {hasPhoto?<ReportButton copper label="View My Analysis" disabled={isBusy||!!errorMessage} onPress={()=>router.push('/skin-story')}/>:<ReportButton copper label="Take Photo" disabled={isBusy||!entryId} onPress={()=>void capturePhoto()}/>}
        <View style={{flexDirection:'row',gap:10}}>
          {hasPhoto?<View style={{flex:1}}><ReportButton secondary label="Retake Photo" disabled={isBusy} onPress={()=>void capturePhoto()}/></View>:null}
          <View style={{flex:1}}><ReportButton secondary label="Choose from Library" disabled={isBusy||!entryId} onPress={()=>void choosePhoto()}/></View>
        </View>
      </Panel>
      {photoAnalysis?<Panel><Copy kind="heading">Photo quality</Copy><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{[['Face',photoAnalysis.faceDetected?'Detected':'Retake'],['Light',photoAnalysis.lighting],['Sharpness',photoAnalysis.sharpness],['Framing',photoAnalysis.framing]].map(([label,value])=><View key={label} style={{flexBasis:'47%',flexGrow:1,padding:12,borderRadius:12,backgroundColor:t.paper,borderWidth:1,borderColor:t.line,gap:4}}><Copy kind="small" style={{color:t.muted}}>{label}</Copy><Copy>{typeof value==='number'?Math.round(value):value??'—'}</Copy></View>)}</View>{photoAnalysis.summary?<Copy kind="small" style={{color:t.muted}}>{photoAnalysis.summary}</Copy>:null}</Panel>:<Panel><Copy kind="heading">For a clearer picture</Copy>{[{icon:Sun,text:'Use natural light. Avoid harsh shadows.'},{icon:ScanFace,text:'Face the camera and keep your face centered.'},{icon:Camera,text:'Use the same angle each day.'}].map(({icon:Icon,text})=><View key={text} style={{flexDirection:'row',gap:12,alignItems:'center'}}><Icon size={21} color={t.gold}/><Copy kind="small" style={{flex:1,color:t.muted}}>{text}</Copy></View>)}</Panel>}
      <Pressable accessibilityRole="button" onPress={()=>router.replace('/your-day')} disabled={isBusy} style={{minHeight:44,alignItems:'center',justifyContent:'center'}}><Copy kind="small" style={{color:'#D2DCE1'}}>{hasPhoto?'Back to Your Day':'Skip for now'}</Copy></Pressable>
    </View>
  </ReportFrame>;
}
