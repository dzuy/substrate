import { TateDrawerProvider } from "@/components/tate-drawer";
import { Stack, useGlobalSearchParams, usePathname } from "expo-router";
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
  const { onboarding } = useGlobalSearchParams<{ onboarding?: string }>();
  const isOnboarding = pathname === "/onboarding" || (pathname.startsWith("/skin-wardrobe") && onboarding === "1");
  const isLandingRoute = pathname === "/";
  const isAppAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");

  const isStyleGuideRoute = pathname === "/style-guide";
  const isResetPasswordRoute = pathname === "/reset-password";
  const isAdminRoute =
    pathname === "/admin" ||
    pathname === "/admin-products" ||
    pathname.startsWith("/admin/");

  return (
    <TateDrawerProvider key={session?.user.id || "guest"}><ProfilePanelProvider>
      <View style={styles.appFrame}>
        {session && !isLoading &&
        !isOnboarding &&
        !isLandingRoute &&
        !isAdminRoute &&
        !isStyleGuideRoute &&
        !isResetPasswordRoute ? (
          <AppHeader />
        ) : null}
        <Stack
          screenLayout={({ children }) => {
            if (isLandingRoute) return children;
            if (isLoading) return (
              <View style={styles.loadingScreen}>
                <ActivityIndicator color={Colors.light.accent} />
                <SubstrateText variant="small" color={Colors.light.textMuted}>
                  Loading your profile
                </SubstrateText>
              </View>
            );
            if (!session && !isStyleGuideRoute && pathname !== "/onboarding") return <AuthScreen admin={isAppAdminRoute} />;
            return children;
          }}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.light.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="home" />
          <Stack.Screen name="explore" />
          <Stack.Screen name="membership" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="daily-check-in" />
          <Stack.Screen name="your-day" />
          <Stack.Screen name="routine" />
          <Stack.Screen name="category" />
          <Stack.Screen name="summary" />
          <Stack.Screen name="shop" />
          <Stack.Screen name="you" />
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
        {session && !isLoading && !isLandingRoute && !isResetPasswordRoute && !isAdminRoute && !isStyleGuideRoute && !isOnboarding && pathname !== "/daily-check-in" && pathname !== "/home" ? (
          <BottomNav />
        ) : null}
      </View>
    </ProfilePanelProvider></TateDrawerProvider>
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
