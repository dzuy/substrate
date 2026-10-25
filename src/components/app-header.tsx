import { useTate } from "./tate-drawer";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
import { Link, usePathname, useRouter, type Href } from "expo-router";
import { ArrowLeft, MessageCircle, X } from "lucide-react-native";
import {
  Pressable,
  View,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Copy } from "@/report/ui";
import { useReportTheme } from "@/report/theme";
import { ProfileContent } from "./profile-content";
const ProfileContext = createContext({ openProfile: () => {} });
export const useProfilePanel = () => useContext(ProfileContext);
export function ProfilePanelProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const { theme: t } = useReportTheme();
  const openProfile = useCallback(() => setOpen(true), []);
  return (
    <ProfileContext.Provider value={{ openProfile }}>
      {children}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#102F3C66",
          }}
        >
          <Pressable
            accessibilityLabel="Dismiss Profile"
            onPress={() => setOpen(false)}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            }}
          />
          <View
            accessibilityViewIsModal
            style={{
              height: "88%",
              maxHeight: 900,
              width: "100%",
              maxWidth: 740,
              alignSelf: "center",
              borderTopLeftRadius: t.radius,
              borderTopRightRadius: t.radius,
              backgroundColor: t.paper,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                paddingHorizontal: 24,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottomWidth: 1,
                borderColor: t.line,
              }}
            >
              <Copy kind="heading">Profile</Copy>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close Profile"
                onPress={() => setOpen(false)}
                style={{
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={23} color={t.ink} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <ProfileContent onNavigate={() => setOpen(false)} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ProfileContext.Provider>
  );
}
export function AppHeader() {
  const {openTate} = useTate();
  const { theme: t } = useReportTheme();
  const pathname = usePathname();
  const router = useRouter();
  const dailyEntry = pathname === "/daily-check-in" || pathname === "/home";
  const isTate = pathname === "/ask-tate";
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{
        backgroundColor: dailyEntry ? "#031723" : t.ink,
        borderBottomWidth: 1,
        borderColor: dailyEntry ? "#031723" : t.ink,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 560,
          alignSelf: "center",
          paddingHorizontal: 16,
          paddingVertical: 2,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {isTate ? <Pressable accessibilityRole="button" accessibilityLabel="Back to previous screen" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={{minWidth:64,height:44,flexDirection:'row',gap:4,alignItems:'center'}}><ArrowLeft size={20} color={t.paper}/><Copy kind="small" style={{color:t.paper}}>Back</Copy></Pressable> : <View style={{width:44}}/>}
        <Link href={"/home" as Href} accessibilityLabel="Substrate home">
          <Copy kind="eyebrow" style={{color:t.paper,fontSize:11,letterSpacing:3.5}}>SUBSTRATE</Copy>
        </Link>

        {isTate ? <View style={{width:64}}/> : <Pressable onPress={()=>openTate()} accessibilityRole="button" accessibilityLabel="Ask Tate" style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><MessageCircle size={21} color="#F2C18D"/></Pressable>}
      </View>
    </SafeAreaView>
  );
}
