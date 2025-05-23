import { useEffect, useState } from "react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { BrowserRouter } from "react-router-dom";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function AppProvider({ children }: Props) {
  const [i18n, setI18n] = useState(null);

  useEffect(() => {
    (async () => {
      const data = await import("@shopify/polaris/locales/en.json");
      setI18n(data.default);
    })();
  }, []);

  if (!i18n) return null; // 혹은 로딩 스피너 등 표시 가능

  return (
    <PolarisAppProvider i18n={i18n}>
      <BrowserRouter>{children}</BrowserRouter>
    </PolarisAppProvider>
  );
}
