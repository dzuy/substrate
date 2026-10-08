import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import {
  Copy,
  Notice,
  Panel,
  ReportButton,
  ReportFrame,
  Spiral,
} from "@/report/ui";
import {
  defaultReportTheme,
  useReportTheme,
  type ReportTheme,
} from "@/report/theme";

export default function StyleGuide() {
  const { theme: t, update, reset, error } = useReportTheme();
  return (
    <ReportFrame wide>
      <Copy kind="eyebrow" style={{ color: t.gold }}>
        SUBSTRATE / DESIGN SYSTEM
      </Copy>
      <Copy kind="title">A shared visual language.</Copy>
      <Copy style={{ color: t.muted }}>
        Change a token, see the report experience change. Settings are saved in
        this browser or device. The consumer report journey and PDF use these
        tokens; existing catalog tools keep their own workspace styles.
      </Copy>
      {error ? <Notice>{error}</Notice> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 24 }}>
        <View style={{ flexGrow: 1, flexBasis: 280, gap: 24 }}>
          <Panel>
            <Copy kind="heading">01 / Color</Copy>
            {(
              ["ink", "paper", "surface", "gold", "muted", "line"] as const
            ).map((key) => (
              <ColorField
                key={key}
                name={key}
                value={t[key]}
                onChange={(v) => update({ [key]: v })}
              />
            ))}
          </Panel>
          <Panel>
            <Copy kind="heading">02 / Typography</Copy>
            {(["headingFont", "bodyFont"] as const).map((key) => (
              <View key={key} style={{ gap: 10 }}>
                <Copy kind="small">
                  {key === "headingFont"
                    ? "Editorial headings"
                    : "Reading text"}
                </Copy>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {["serif", "sans"].map((value) => (
                    <Choice
                      key={value}
                      label={
                        value === "serif" ? "Classic serif" : "Modern sans"
                      }
                      active={t[key] === value}
                      onPress={() => update({ [key]: value })}
                    />
                  ))}
                </View>
              </View>
            ))}
            <Copy kind="small">Type scale</Copy>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {[0.9, 1, 1.1, 1.2].map((scale) => (
                <Choice
                  key={scale}
                  label={`${Math.round(scale * 100)}%`}
                  active={t.scale === scale}
                  onPress={() => update({ scale })}
                />
              ))}
            </View>
          </Panel>
          <Panel>
            <Copy kind="heading">03 / Shape</Copy>
            <Copy kind="small">Corner radius</Copy>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {[0, 8, 18, 28].map((radius) => (
                <Choice
                  key={radius}
                  label={`${radius}px`}
                  active={t.radius === radius}
                  onPress={() => update({ radius })}
                />
              ))}
            </View>
            <ReportButton
              secondary
              label="Restore Substrate defaults"
              onPress={reset}
            />
          </Panel>
        </View>
        <View style={{ flexGrow: 1, flexBasis: 280, gap: 24 }}>
          <Panel style={{ backgroundColor: t.ink }}>
            <Copy kind="eyebrow" style={{ color: t.gold }}>
              LIVE PREVIEW
            </Copy>
            <Spiral size={180} />
            <Copy kind="title" style={{ color: t.paper }}>
              Your skin.{"\n"}A clearer direction.
            </Copy>
            <Copy style={{ color: t.paper }}>
              Personal insights, connected to the ingredients and products that
              matter to you.
            </Copy>
          </Panel>
          <Panel>
            <Copy kind="eyebrow" style={{ color: t.gold }}>
              YOUR SKIN SIGNATURE
            </Copy>
            <Copy kind="heading">Understand what you see.</Copy>
            <Copy style={{ color: t.muted }}>
              A calm, thoughtful report built around your photo, your context,
              and your next decision.
            </Copy>
            <ReportButton label="Example primary action" onPress={() => {}} />
            <ReportButton
              label="Example secondary action"
              secondary
              onPress={() => {}}
            />
          </Panel>
          <Panel>
            <Copy kind="heading">Current tokens</Copy>
            <TextInput
              accessibilityLabel="Design tokens JSON"
              multiline
              editable={false}
              value={JSON.stringify(t, null, 2)}
              style={{
                fontFamily: "monospace",
                color: t.ink,
                fontSize: 12,
                minHeight: 250,
              }}
            />
            <Copy kind="small">
              Copy these tokens to share a direction with your team. Default
              palette: {defaultReportTheme.ink}, {defaultReportTheme.paper},{" "}
              {defaultReportTheme.gold}.
            </Copy>
          </Panel>
        </View>
      </View>
    </ReportFrame>
  );
}
function Choice({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme: t } = useReportTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: active ? t.ink : t.line,
        backgroundColor: active ? t.ink : t.surface,
      }}
    >
      <Copy kind="small" style={{ color: active ? t.paper : t.ink }}>
        {label}
      </Copy>
    </Pressable>
  );
}
function ColorField({
  name,
  value,
  onChange,
}: {
  name: keyof ReportTheme;
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: value,
          borderWidth: 1,
          borderColor: "#CBD0CC",
        }}
      />
      <Copy style={{ flex: 1 }}>{name}</Copy>
      <TextInput
        accessibilityLabel={`${name} hex color`}
        value={draft}
        onChangeText={(next) => {
          setDraft(next);
          if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next);
        }}
        autoCapitalize="none"
        maxLength={7}
        style={{
          borderWidth: 1,
          borderColor: "#CBD0CC",
          padding: 10,
          borderRadius: 8,
          width: 110,
          color: "#102F3C",
          backgroundColor: "#fff",
        }}
      />
    </View>
  );
}
