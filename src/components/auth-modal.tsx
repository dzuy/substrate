import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthScreen } from "@/components/auth-screen";
import { Copy } from "@/report/ui";

export function AuthModal({ visible, onClose, initialMode = "sign-up" }: {
  visible: boolean;
  onClose: () => void;
  initialMode?: "sign-in" | "sign-up";
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close account dialog" onPress={onClose} style={styles.close}>
            <Copy kind="small">Close ✕</Copy>
          </Pressable>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 8 }}>
            {visible ? <AuthScreen embedded initialMode={initialMode} /> : null}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#00121DCC", justifyContent: "center", alignItems: "center", padding: 16 },
  dialog: { flexShrink: 1, width: "100%", maxWidth: 440, maxHeight: "90%", backgroundColor: "#FBF6EE", borderRadius: 24, overflow: "hidden" },
  close: { alignSelf: "flex-end", paddingHorizontal: 20, minHeight: 44, justifyContent: "center" },
});
