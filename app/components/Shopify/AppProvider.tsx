import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import "@shopify/polaris/build/esm/styles.css";

// Polaris에서 자동으로 en.json을 처리하게 두는 방식
interface Props {
  children: ReactNode;
}

export function AppProvider({ children }: Props) {
  return (
    <PolarisAppProvider i18n={{}}>
      <BrowserRouter>{children}</BrowserRouter>
    </PolarisAppProvider>
  );
}
