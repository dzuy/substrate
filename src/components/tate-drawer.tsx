import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Animated, Easing, Keyboard, Modal, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { TateChatPage } from './tate-chat-page';
import { Copy } from '@/report/ui';
import { useReportTheme } from '@/report/theme';

const TateContext = createContext({ openTate: (_prompt?: string) => {} });
export const useTate = () => useContext(TateContext);

export function TateDrawerProvider({ children }: PropsWithChildren) {
  const { theme:t } = useReportTheme();
  const { height } = useWindowDimensions();
  const [visible,setVisible] = useState(false);
  const [prompt,setPrompt] = useState('');
  const progress = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const openTate = useCallback((text?:string)=>{closing.current=false;setPrompt(text||'');setVisible(true);},[]);
  useEffect(()=>{
    if(!visible)return;
    progress.setValue(0);
    const animation=Animated.timing(progress,{toValue:1,duration:320,easing:Easing.out(Easing.cubic),useNativeDriver:Platform.OS!=='web'});
    animation.start();
    return()=>animation.stop();
  },[visible,progress]);
  const close = useCallback(()=>{
    if(closing.current)return;
    closing.current=true;Keyboard.dismiss();
    Animated.timing(progress,{toValue:0,duration:240,easing:Easing.in(Easing.cubic),useNativeDriver:Platform.OS!=='web'}).start(({finished})=>{if(finished){setVisible(false);closing.current=false;}});
  },[progress]);
  return <TateContext.Provider value={{openTate}}>
    {children}
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <View style={{flex:1,justifyContent:'flex-end'}}>
        <Animated.View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'#000',opacity:progress.interpolate({inputRange:[0,1],outputRange:[0,0.5]})}}/>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss Tate chat" onPress={close} style={{position:'absolute',top:0,left:0,right:0,bottom:0}}/>
        <Animated.View accessibilityViewIsModal style={{height:'90%',width:'100%',maxWidth:620,alignSelf:'center',borderTopLeftRadius:26,borderTopRightRadius:26,overflow:'hidden',backgroundColor:t.paper,transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[height,0]})}]}}>
          <View style={{alignItems:'center',paddingTop:9}}><View style={{width:36,height:4,borderRadius:2,backgroundColor:'#CFC6B9'}}/></View>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingLeft:23,paddingRight:10,paddingVertical:4,borderBottomWidth:1,borderColor:t.line}}><Copy kind="heading" style={{color:t.ink,fontSize:25}}>Ask Tate</Copy><Pressable accessibilityRole="button" accessibilityLabel="Close Tate chat" onPress={close} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><X size={23} color={t.ink}/></Pressable></View>
          <SafeAreaView edges={['bottom']} style={{flex:1,minHeight:0}}><TateChatPage initialPrompt={prompt}/></SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  </TateContext.Provider>;
}
