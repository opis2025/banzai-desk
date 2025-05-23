import type { AppConfig } from "@remix-run/dev";

export default {
  future: {
    v2_routeConvention: true,
  },
  serverModuleFormat: "esm",
  ignoredRouteFiles: ["**/.*"],
  serverDependenciesToBundle: [
    "@shopify/shopify-app-remix",
    "@shopify/polaris",
  ],
} satisfies AppConfig;
