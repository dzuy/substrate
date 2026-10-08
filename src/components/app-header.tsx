import {
  createContext,
  useCallback,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
import { Link, type Href } from "expo-router";
import { CircleUserRound, X } from "lucide-react-native";
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
  const { openProfile } = useProfilePanel();
  const { theme: t } = useReportTheme();
  return (
    <SafeAreaView
      edges={["top"]}
      style={{
        backgroundColor: t.paper,
        borderBottomWidth: 1,
        borderColor: t.line,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 1128,
          alignSelf: "center",
          paddingHorizontal: 24,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href={"/" as Href} accessibilityLabel="Substrate home">
          <Copy kind="brand">
            Substrate<Copy kind="small">™</Copy>
          </Copy>
        </Link>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile"
          onPress={openProfile}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: t.line,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? t.surface : t.paper,
          })}
        >
          <CircleUserRound color={t.ink} size={23} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
