import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
//import "@shopify/polaris/build/esm/styles.css";


// Polaris i18n JSON을 require 방식으로 불러오기
//const en = require("@shopify/polaris/locales/en.json");
const messages = await import("@shopify/polaris/locales/en.json", {
  with: { type: "json" }
});

interface Props {
  children: ReactNode;
}

export function AppProvider({ children }: Props) {
  return (
    <PolarisAppProvider i18n={messages}>
      <BrowserRouter>{children}</BrowserRouter>
    </PolarisAppProvider>
  );
}
