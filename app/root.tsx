import {LoaderFunctionArgs} from '@remix-run/node';
//import { AppProvider } from '@shopify/shopify-app-remix/react';
import { AppProvider } from './components/Shopify/AppProvider'; // 상대 경로 주의


import shopify from './shopify.server';
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

const polarisStyles = require.resolve("@shopify/polaris/build/esm/styles.css");

export function links() {
  return [{ rel: "stylesheet", href: polarisStyles }];
}

import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

export async function loader({request}: LoaderFunctionArgs) {
  await shopify.authenticate.admin(request);

  return json({
    apiKey: process.env.SHOPIFY_API_KEY,
  });
}


export default function App() {
  const {apiKey} = useLoaderData<typeof loader>();
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
      <AppProvider apiKey={apiKey} isEmbeddedApp>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </AppProvider>
      </body>
    </html>
  );
}
