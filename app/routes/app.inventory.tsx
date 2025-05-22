// app/routes/app.inventory.tsx – 커서 기반 페이지네이션 통합 버전

import {
  Card,
  Page,
  Layout,
  IndexTable,
  useIndexResourceState,
  TextField,
  Thumbnail,
  Button,
  Popover,
  Text,
  Select,
  Box,
  Toast,
  Frame,
} from "@shopify/polaris";
import { json, LoaderFunction, ActionFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams, useFetcher } from "@remix-run/react";
import { gql } from "graphql-request";
import { authenticate } from "../shopify.server";
import { useState, useEffect, useCallback } from "react";

interface ProductInfo {
  id: string;
  title: string;
  status: string;
  image?: string;
  sku?: string;
  collections: string[];
  inventoryItemId: string;
  locationId: string;
  available: number;
  committed: number;
  cursor?: string;
}

export const loader: LoaderFunction = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") || null;
  const direction = url.searchParams.get("direction") || "next";
  const isPrev = direction === "prev";
  const limit = 20;

  const gqlQuery = gql`
    query getProducts(
      $after: String
      $before: String
      $first: Int
      $last: Int
    ) {
      products(
        sortKey: CREATED_AT
        reverse: true
        after: $after
        before: $before
        first: $first
        last: $last
      ) {
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        edges {
          cursor
          node {
            id
            title
            status
            images(first: 1) { edges { node { transformedSrc } } }
            collections(first: 5) { edges { node { title } } }
            variants(first: 1) {
              edges {
                node {
                  sku
                  inventoryItem { id }
                }
              }
            }
          }
        }
      }
    }
  `;

  const variables = {
    ...(isPrev ? { before: cursor, last: limit } : { after: cursor, first: limit })
  };

  const response = await admin.graphql(gqlQuery, { variables });
  const jsonResp = await response.json();
  const data = jsonResp.data.products;
  const pageInfo = data.pageInfo;
  const productEdges = data.edges;

  const inventoryItemMap = new Map<string, string>();

  const products: ProductInfo[] = productEdges.map((edge: any) => {
    const p = edge.node;
    const variant = p.variants.edges[0]?.node;
    const inventoryItemId = variant?.inventoryItem?.id;
    const inventoryItemNum = inventoryItemId?.split("/").pop();
    if (inventoryItemId && inventoryItemNum) {
      inventoryItemMap.set(inventoryItemNum, p.id);
    }
    return {
      id: p.id.split("/").pop(),
      title: p.title,
      status: p.status,
      image: p.images.edges?.[0]?.node?.transformedSrc ?? undefined,
      sku: variant?.sku ?? "-",
      collections: p.collections.edges.map((c: any) => c.node.title),
      inventoryItemId: inventoryItemNum,
      locationId: "",
      available: 0,
      committed: 0,
      cursor: edge.cursor,
    };
  });

  const ids = Array.from(inventoryItemMap.keys());
  const inventoryLevels: Record<string, { available: number; committed: number; locationId: string }> = {};

  if (ids.length > 0) {
    const shop = session.shop;
    const accessToken = session.accessToken;
    const restResponse = await fetch(
      `https://${shop}/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${ids.join(",")}`,
      {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      }
    );
    const restJson = await restResponse.json();
    for (const level of restJson.inventory_levels || []) {
      inventoryLevels[level.inventory_item_id] = {
        available: level.available,
        committed: level.committed ?? 0,
        locationId: level.location_id,
      };
    }
  }

  const mergedProducts = products.map((p) => ({
    ...p,
    available: inventoryLevels[p.inventoryItemId]?.available ?? 0,
    committed: inventoryLevels[p.inventoryItemId]?.committed ?? 0,
    locationId: inventoryLevels[p.inventoryItemId]?.locationId ?? "",
  }));

  return json({ products: mergedProducts, pageInfo });
};

export const action: ActionFunction = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const items = form.getAll("items[]").map(i => JSON.parse(i as string));

  for (const { inventoryItemId, locationId, available } of items) {
    await fetch(`https://${session.shop}/admin/api/2024-01/inventory_levels/set.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": session.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inventory_item_id: inventoryItemId,
        location_id: locationId,
        available: parseInt(available),
      }),
    });
  }

  return json({ success: true });
};

export default function InventoryPage() {
  const { products, pageInfo } = useLoaderData<typeof loader>();
  const resourceState = useIndexResourceState(products);
  const [searchParams] = useSearchParams();
  const selectedCollection = searchParams.get("collection") || "";
  const filteredProducts = selectedCollection
  ? products.filter(p => p.collections.includes(selectedCollection))
  : products;
  const fetcher = useFetcher();
  const [state, setState] = useState(() =>
    Object.fromEntries(
      products.map((p) => [p.id, {
        adjustBy: "0",
        reason: "correction",
      }])
    )
  );
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setShowToast(true);
    }
  }, [fetcher]);

  const handlePopoverToggle = useCallback((id: string | null) => {
    setActivePopoverId((prev) => (prev === id ? null : id));
  }, []);

  const handleChange = (id: string, field: "adjustBy" | "reason", value: string) => {
    setState((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSave = () => {
    const form = new FormData();
    resourceState.selectedResources.forEach((id) => {
      const product = products.find(p => p.id === id);
      const adjust = state[id];
      if (product && adjust) {
        const newAvailable = product.available + parseInt(adjust.adjustBy || "0");
        form.append("items[]", JSON.stringify({
          inventoryItemId: product.inventoryItemId,
          locationId: product.locationId,
          available: newAvailable,
        }));
      }
    });
    fetcher.submit(form, { method: "post", action: "/app/inventory" });
  };

  return (
    <Frame>
      <Page title="Custom Inventory Page" fullWidth>
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                alignItems: "flex-end",
                gap: "1rem"
              }}>
                {/* 왼쪽: 필터 */}
                <Select
                  label="Collection Filter"
                  options={[
                    { label: "All", value: "" },
                    ...Array.from(new Set(products.flatMap(p => p.collections))).map(c => ({ label: c, value: c }))
                  ]}
                  value={searchParams.get("collection") || ""}
                  onChange={(value) => {
                    const params = new URLSearchParams(window.location.search);
                    if (value) {
                      params.set("collection", value);
                    } else {
                      params.delete("collection");
                    }
                    window.location.search = params.toString();
                  }}
                />

                {/* 오른쪽: Save 버튼 */}
                <Button
                  onClick={handleSave}
                  disabled={resourceState.selectedResources.length === 0}
                  variant="primary"
                >
                  Save Selected
                </Button>
              </div>
            </Card>
            <Card sectioned>
              <IndexTable
                resourceName={{ singular: "product", plural: "products" }}
                itemCount={filteredProducts.length}
                selectedItemsCount={
                  resourceState.allResourcesSelected
                    ? "All"
                    : resourceState.selectedResources.length
                }
                onSelectionChange={resourceState.handleSelectionChange}
                headings={[
                  { title: "" },
                  { title: "Image" },
                  { title: "Title", width: "10%"},
                  { title: "SKU" },
                  { title: "Collections", width: "10%"},
                  { title: "Committed" },
                  { title: "Available" },
                  { title: "On Hand" },
                ]}
                selectable
              >
                {filteredProducts.map((p, index) => (
                  <IndexTable.Row
                    id={p.id}
                    key={p.id}
                    selected={resourceState.selectedResources.includes(p.id)}
                    position={index}
                  >
                    <IndexTable.Cell />
                    <IndexTable.Cell>
                      {p.image ? <Thumbnail source={p.image} alt={p.title} size="small" /> : "-"}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <div style={{ wordWrap: "break-word", whiteSpace: "normal" }}>{p.title}</div>                        
                    </IndexTable.Cell>
                    <IndexTable.Cell>{p.sku}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <div style={{ wordWrap: "break-word", whiteSpace: "normal" }}>
                        {p.collections.join(", ")}
                      </div>                      
                    </IndexTable.Cell>
                    <IndexTable.Cell>{p.committed}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <Popover
                        active={activePopoverId === p.id}
                        activator={
                          <Button onClick={() => handlePopoverToggle(p.id)} disclosure>
                            Adjust Available (Current: {p.available})
                          </Button>                         
                        }
                        onClose={() => handlePopoverToggle(null)}
                      >
                        <Box padding="400" width="250px">
                          <TextField
                            label="Adjust by"
                            type="number"
                            value={state[p.id].adjustBy}
                            onChange={(val) => handleChange(p.id, "adjustBy", val)}
                            autoComplete="off"
                          />
                          <Select
                            label="Reason"
                            options={[
                              { label: "Correction (default)", value: "correction" },
                              { label: "Damaged", value: "damaged" },
                              { label: "Lost", value: "lost" },
                            ]}
                            value={state[p.id].reason}
                            onChange={(val) => handleChange(p.id, "reason", val)}
                          />
                        </Box>
                      </Popover>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text>{p.available + parseInt(state[p.id].adjustBy)}</Text>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </Card>

            <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem", marginBottom: "2rem", gap: "1rem" }}>
              {pageInfo?.hasPreviousPage && (
                <Button onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("cursor", products[0].cursor || "");
                  url.searchParams.set("direction", "prev");
                  window.location.href = url.toString();
                }} variant="secondary">⬅️ Prev</Button>
              )}
              {pageInfo?.hasNextPage && filteredProducts.length === 20 && (
                <Button onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("cursor", products[products.length - 1].cursor || "");
                  url.searchParams.set("direction", "next");
                  window.location.href = url.toString();
                }} variant="primary">Next ➡️</Button>
              )}
            </div>
          </Layout.Section>
        </Layout>
        {showToast && <Toast content="Inventory updated" onDismiss={() => setShowToast(false)} duration={3000} />}
      </Page>
    </Frame>
  );
}
