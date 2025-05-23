import { useEffect, useState } from "react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { BrowserRouter } from "react-router-dom";
import type { ReactNode } from "react";
import en from "@shopify/polaris/locales/en.json";

interface Props {
  children: ReactNode;
}

export function AppProvider({ children }: Props) {
  const i18n = en;
return (
  <PolarisAppProvider i18n={i18n}>
    <BrowserRouter>{children}</BrowserRouter>
  </PolarisAppProvider>
);
}
