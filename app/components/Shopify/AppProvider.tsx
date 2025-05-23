import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import "@shopify/polaris/build/esm/styles.css";

// en.json을 직접 import하지 않고 Polaris에서 자동 처리하게 둡니다
// 이 방식은 렌더에서도 잘 작동합니다.

interface Props {
  children: ReactNode;
}

export function AppProvider({ children }: Props) {
  return (
    <PolarisAppProvider i18n={{}}>
      {children}
    </PolarisAppProvider>
  );
}
