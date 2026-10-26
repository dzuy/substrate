import { useRouter } from 'expo-router';
import { saveDayWithTate } from '@/services/tate-day';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
  Pressable,
} from "react-native";
import { ArrowUp } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Copy, Notice, ReportButton } from "@/report/ui";
import { fontFamily, useReportTheme } from "@/report/theme";

export type Message = {
  routineLink?: boolean;
  role: "user" | "assistant";
  content: string;
  sources?: { id: string; name: string; brand: string }[];
  followUps?: { label: string; question: string }[];
};
export function TateChatPage({ initialPrompt = "", messages: sharedMessages, onMessagesChange, dayMode = false, dayRequest, onDayRequestHandled, onDaySaved, onNavigate }: {
  initialPrompt?: string;
  messages?: Message[];
  onMessagesChange?: Dispatch<SetStateAction<Message[]>>;
  dayMode?: boolean;
  dayRequest?: {id: number; text: string} | null;
  onDayRequestHandled?: () => void;
  onDaySaved?: () => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { theme: t } = useReportTheme();
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const messages = sharedMessages ?? localMessages;
  const setMessages = onMessagesChange ?? setLocalMessages;
  const prompt = initialPrompt;
  const [question, setQuestion] = useState(prompt || "");
  useEffect(()=>{if(prompt)setQuestion(prompt);},[prompt]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const conversation = useRef<ScrollView>(null);
  const input = useRef<TextInput>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );
  async function send(text = question, newDay = false) {
    if (lock.current || !text.trim()) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const next: Message[] = [
      ...messages,
      { role: "user", content: text.trim() },
    ];
    const history = next
      .slice(-23)
      .map(({ role, content }) => ({ role, content }));
    while (JSON.stringify(history).length > 45000 && history.length > 1)
      history.splice(0, 2);
    setMessages(next);
    setQuestion("");
    const request = new AbortController();
    controller.current = request;
    const timeout = setTimeout(() => request.abort(), 175000);
    try {
      if (dayMode || newDay) {
        const saved = await saveDayWithTate(text.trim(), !newDay, request.signal);
        if (saved) {
        onDaySaved?.();
        setMessages([...next, { role: 'assistant', content: saved.routineReady
          ? `Great, I’ve set this as your plan for today and updated your routine.${saved.activities.length ? '\n\n' + saved.activities.map(activity => '• ' + activity).join('\n') : ''}`
          : 'Your day is saved. I couldn’t refresh your routine just yet—open Routine to retry the update.', routineLink: true }]);
        return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw Error("Sign in again to ask Tate.");
      const endpoint =
        process.env.EXPO_PUBLIC_TATE_API_URL ||
        (Platform.OS === "web"
          ? __DEV__ &&
            ["localhost", "127.0.0.1"].includes(window.location.hostname)
            ? `http://${window.location.hostname}:4318/api/ask-tate`
            : "/api/ask-tate"
          : "");
      if (!endpoint)
        throw Error("The chat server address is not configured for this app.");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ messages: history, audience: "customer" }),
        signal: request.signal,
      });
      const result = await response.json();
      if (!response.ok || typeof result.answer !== "string")
        throw Error(result.error || "Tate is unavailable. Please try again.");
      if (controller.current !== request) return;
      setMessages([
        ...next,
        {
          role: "assistant",
          content: result.answer,
          sources: result.sources,
          followUps: result.followUps,
        },
      ]);
    } catch (e) {
      if (controller.current !== request) return;
      setMessages(next.slice(0, -1));
      setQuestion(text);
      setError(
        request.signal.aborted
          ? "Tate took too long. Please try again."
          : e instanceof Error
            ? e.message
            : "Could not connect to Tate.",
      );
    } finally {
      clearTimeout(timeout);
      lock.current = false;
      setBusy(false);
    }
  }
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; });
  const handledRequest = useRef<number | null>(null);
  useEffect(() => {
    if (!dayRequest || handledRequest.current === dayRequest.id || lock.current) return;
    handledRequest.current = dayRequest.id;
    onDayRequestHandled?.();
    void sendRef.current(dayRequest.text, true);
  }, [dayRequest, onDayRequestHandled, busy]);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: t.paper }}
    >
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 900,
          alignSelf: "center",
          backgroundColor: t.paper,
        }}
      >
        <ScrollView
          ref={conversation}
          style={{ flex: 1 }}
          onContentSizeChange={() =>
            conversation.current?.scrollToEnd({ animated: true })
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, gap: 20 }}
        >
          {!messages.length ? (
            <View style={{ gap: 16 }}>
              <Copy kind="heading">{dayMode ? "What would you like to change about your day?" : "What would you like to understand?"}</Copy>
              <Copy style={{ color: t.muted }}>
                {dayMode ? 'Tell me what to add or change. I’ll save your plans and update your routine, or answer any questions you have.' : 'Explore your wardrobe, understand your reports, and connect the dots with your profile.'}
              </Copy>
              {(dayMode ? [] : [
                "How do the products in my wardrobe relate to my latest report?",
                "How many reports have I done, and what does my latest one say?",
              ]).map((q) => (
                <ReportButton
                  key={q}
                  secondary
                  label={q}
                  disabled={busy}
                  onPress={() => void send(q)}
                />
              ))}
            </View>
          ) : null}
          {messages.map((m, i) => (
            <View
              key={i}
              style={{
                gap: 10,
                padding: 16,
                backgroundColor: m.role === "user" ? t.surface : t.paper,
                borderRadius: t.radius,
                borderWidth: m.role === "user" ? 1 : 0,
                borderColor: t.line,
              }}
            >
              <Copy kind="eyebrow" style={{ color: t.gold }}>
                {m.role === "user" ? "YOU" : "TATE"}
              </Copy>
              <Copy>{m.content}</Copy>
              {m.routineLink ? <ReportButton copper label="View Routine" disabled={busy} onPress={() => { onNavigate?.(); router.push("/routine"); }}/> : null}
              {m.sources?.length ? (
                <View
                  style={{
                    borderTopWidth: 1,
                    borderColor: t.line,
                    paddingTop: 12,
                    gap: 4,
                  }}
                >
                  <Copy kind="small" style={{ color: t.muted }}>
                    Catalog records consulted
                  </Copy>
                  {m.sources.map((source) => (
                    <Copy kind="small" key={source.id}>
                      {source.brand ? source.brand + " · " : ""}
                      {source.name}
                    </Copy>
                  ))}
                </View>
              ) : null}
              {i === messages.length - 1
                ? m.followUps?.map((f) => (
                    <ReportButton
                      key={f.question}
                      secondary
                      label={f.label}
                      disabled={busy}
                      onPress={() => void send(f.question)}
                    />
                  ))
                : null}
            </View>
          ))}
          {busy ? (
            <View
              accessibilityLiveRegion="polite"
              style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
            >
              <ActivityIndicator color={t.gold} />
              <Copy kind="small">{dayMode ? 'Tate is updating your day and routine…' : 'Tate is looking into your question…'}</Copy>
            </View>
          ) : null}
        </ScrollView>
        <View
          style={{
            padding: 20,
            gap: 12,
            borderTopWidth: 1,
            borderColor: t.line,
            backgroundColor: t.surface,
          }}
        >
          {error ? <Notice>{error}</Notice> : null}
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TextInput
              ref={input}
              accessibilityLabel="Ask Tate a question"
              placeholder="Ask Tate…"
              placeholderTextColor={t.muted}
              multiline
              returnKeyType="send"
              submitBehavior={Platform.OS === 'web' ? undefined : 'submit'}
              onKeyPress={event => {
                if (Platform.OS !== 'web') return;
                const key = event.nativeEvent as typeof event.nativeEvent & { shiftKey?: boolean; isComposing?: boolean; keyCode?: number };
                if (key.key === 'Enter' && !key.shiftKey && !key.isComposing && key.keyCode !== 229) {
                  event.preventDefault();
                  void send();
                }
              }}
              onSubmitEditing={() => void send()}
              maxLength={4000}
              editable={!busy}
              value={question}
              onChangeText={setQuestion}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 48,
                maxHeight: 120,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: t.line,
                borderRadius: t.radius,
                paddingHorizontal: 16,
                color: t.ink,
                backgroundColor: t.paper,
                fontFamily: fontFamily(t.bodyFont),
                fontSize: 16 * t.scale,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send question"
              accessibilityState={{ disabled: !question.trim() || busy }}
              disabled={!question.trim() || busy}
              onPress={() => void send()}
              style={({ pressed }) => ({
                width: 48,
                minHeight: 48,
                maxHeight: 120,
                paddingVertical: 12,
                borderRadius: 24,
                backgroundColor: t.ink,
                alignItems: "center",
                justifyContent: "center",
                opacity: !question.trim() || busy ? 0.4 : pressed ? 0.75 : 1,
              })}
            >
              {busy ? (
                <ActivityIndicator color={t.paper} />
              ) : (
                <ArrowUp size={23} color={t.paper} />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
