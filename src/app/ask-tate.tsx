import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTate } from '@/components/tate-drawer';

// Keep existing links working while chat itself lives above the current screen.
export default function AskTateRoute() {
  const router=useRouter();
  const {prompt}=useLocalSearchParams<{prompt?:string}>();
  const {openTate}=useTate();
  useEffect(()=>{
    if(router.canGoBack())router.back();else router.replace('/home');
    openTate(prompt);
  },[router,openTate,prompt]);
  return null;
}
