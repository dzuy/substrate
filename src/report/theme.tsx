import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform } from "react-native";

export const defaultReportTheme = {
  ink: "#102F3C",
  paper: "#F6F3EC",
  surface: "#FFFEFA",
  gold: "#AA8248",
  muted: "#647177",
  line: "#DCDCD3",
  headingFont: "serif",
  bodyFont: "sans",
  radius: 18,
  scale: 1,
};
export type ReportTheme = typeof defaultReportTheme;
const Context = createContext({
  theme: defaultReportTheme,
  update: (_value: Partial<ReportTheme>) => {},
  reset: () => {},
  error: "",
});
const key = "substrate-design-system-v1";
export function ReportThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState(defaultReportTheme);
  const [error, setError] = useState("");
  useEffect(() => {
    void AsyncStorage.getItem(key)
      .then((raw) => {
        if (raw) {
          try {
            setTheme(validTheme(JSON.parse(raw)));
          } catch {
            /* Ignore obsolete settings. */
          }
        }
      })
      .catch(() => setError("Style settings could not be loaded."));
  }, []);
  const update = (value: Partial<ReportTheme>) =>
    setTheme((current) => {
      const next = validTheme({ ...current, ...value });
      void AsyncStorage.setItem(key, JSON.stringify(next)).catch(() =>
        setError(
          "Styles changed for this session; device storage is unavailable.",
        ),
      );
      return next;
    });
  return (
    <Context.Provider
      value={{ theme, update, reset: () => update(defaultReportTheme), error }}
    >
      {children}
    </Context.Provider>
  );
}
function validTheme(value: Partial<ReportTheme>): ReportTheme {
  const next = { ...defaultReportTheme };
  for (const key of [
    "ink",
    "paper",
    "surface",
    "gold",
    "muted",
    "line",
  ] as const)
    if (/^#[0-9a-f]{6}$/i.test(value[key] || "")) next[key] = value[key]!;
  for (const key of ["headingFont", "bodyFont"] as const)
    if (["serif", "sans"].includes(value[key] || "")) next[key] = value[key]!;
  if (typeof value.radius === "number")
    next.radius = Math.min(32, Math.max(0, value.radius));
  if (typeof value.scale === "number")
    next.scale = Math.min(1.2, Math.max(0.9, value.scale));
  return next;
}
export const useReportTheme = () => useContext(Context);
export const fontFamily = (kind: string) =>
  kind === "serif"
    ? Platform.select({
        ios: "Georgia",
        android: "serif",
        web: 'Georgia, "Times New Roman", serif',
      })
    : Platform.select({
        ios: "System",
        android: "sans-serif",
        web: "Arial, Helvetica, sans-serif",
      });
