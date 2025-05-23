import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import en from "@shopify/polaris/locales/en.json" with { type: "json" };

interface Props {
  children: ReactNode;
}

export function AppProvider({ children }: Props) {
  return (
    <PolarisAppProvider i18n={en}>
      <BrowserRouter>{children}</BrowserRouter>
    </PolarisAppProvider>
  );
}
