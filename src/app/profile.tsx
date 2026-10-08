import { useEffect } from "react";
import { Redirect } from "expo-router";
import { useProfilePanel } from "@/components/app-header";
export default function ProfileRoute() {
  const { openProfile } = useProfilePanel();
  useEffect(() => {
    openProfile();
  }, [openProfile]);
  return <Redirect href="/" />;
}
