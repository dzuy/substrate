import { TateChatPage } from "@/components/tate-chat-page";
import { useAuth } from "@/lib/auth-context";
export default function AskTateRoute() {
  const { user } = useAuth();
  return user ? <TateChatPage key={user.id} /> : null;
}
