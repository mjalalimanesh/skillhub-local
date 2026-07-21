import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

const THEME_KEY = "skillhub-theme";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemeClass(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.add("light");
  } else {
    root.classList.remove("light");
  }
}

export function useInitTheme() {
  const { data } = useQuery({
    queryKey: ["config"],
    queryFn: api.getConfig,
    staleTime: Infinity,
  });

  useEffect(() => {
    const preference = data?.preferences?.theme ?? "dark";

    if (preference === "system") {
      applyThemeClass(getSystemTheme());
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) =>
        applyThemeClass(e.matches ? "dark" : "light");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }

    applyThemeClass(preference);
  }, [data]);
}
