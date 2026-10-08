import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AppHeader, ProfilePanelProvider } from "@/components/app-header";
import { ReportThemeProvider } from "@/report/theme";
import { AuthScreen } from "@/components/auth-screen";
import { BottomNav, SubstrateText } from "@/components/substrate-ui";
import { Colors } from "@/constants/theme";
import { AuthProvider, useAuth } from "@/lib/auth-context";

export default function RootLayout() {
  return (
    <AuthProvider>
      <ReportThemeProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </ReportThemeProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const { isLoading, session } = useAuth();
  const pathname = usePathname();
  const isAppAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={Colors.light.accent} />
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          Loading your profile
        </SubstrateText>
      </View>
    );
  }

  if (!session && pathname !== "/style-guide") {
    return <AuthScreen admin={isAppAdminRoute} />;
  }

  const isStyleGuideRoute = pathname === "/style-guide";
  const isResetPasswordRoute = pathname === "/reset-password";
  const isAdminRoute =
    pathname === "/admin" ||
    pathname === "/admin-products" ||
    pathname.startsWith("/admin/");

  return (
    <ProfilePanelProvider key={session?.user.id || "guest"}>
      <View style={styles.appFrame}>
        {session &&
        !isAdminRoute &&
        !isStyleGuideRoute &&
        !isResetPasswordRoute ? (
          <AppHeader />
        ) : null}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.light.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="ask-tate" />
          <Stack.Screen name="assessment" />
          <Stack.Screen name="past-reports" />
          <Stack.Screen name="report" />
          <Stack.Screen name="style-guide" />
          <Stack.Screen name="daily" />
          <Stack.Screen name="photo" />
          <Stack.Screen name="check-in" />
          <Stack.Screen name="environment" />
          <Stack.Screen name="skin-story" />
          <Stack.Screen name="daily-plan" />
          <Stack.Screen name="skin-wardrobe" />
          <Stack.Screen name="skin-wardrobe/add-products" />
          <Stack.Screen name="progress" />
          <Stack.Screen name="progress-history" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="admin-products" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="reset-password" />
        </Stack>
        {!isResetPasswordRoute && !isAdminRoute && !isStyleGuideRoute ? (
          <BottomNav />
        ) : null}
      </View>
    </ProfilePanelProvider>
  );
}

const styles = StyleSheet.create({
  appFrame: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: Colors.light.background,
  },
});
