import { AppProvider as PolarisProvider } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";
import { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import "@shopify/polaris/build/esm/styles.css";

interface Props {
  children: ReactNode;
}

export function AppProvider({ children }: Props) {
  return (
    <BrowserRouter>
      <PolarisProvider i18n={en}>{children}</PolarisProvider>
    </BrowserRouter>
  );
}
