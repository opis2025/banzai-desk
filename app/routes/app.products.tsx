// app.products.tsx — 최종 덮어쓰기용 전체 코드

import {
  Card,
  Page,
  Layout,
  IndexTable,
  useIndexResourceState,
  Thumbnail,
  Text,
  Badge,
  Button,
  TextField,
  Select,
  InlineStack,
  BlockStack
} from "@shopify/polaris";
import { json, LoaderFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { gql } from "graphql-request";
import { authenticate } from "../shopify.server";
import React, { useEffect, useState } from "react";

interface Product {
  id: string;
  title: string;
  status: string;
  sku?: string;
  barcode?: string;
  price?: string;
  totalInventory: number;
  image?: string;
  imageAlt?: string;
  collections: string[];
  descriptionHtml?: string;
  cursor?: string;
  createdAt?: string;
  publishedAt?: string;
}

interface LoaderResponse {
  products: Product[];
  pageInfo: any;
  shop: string;
  collectionOptions: { label: string; value: string }[];
  tagOptions: { label: string; value: string }[];
}

export const loader: LoaderFunction = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session?.shop;
  if (!shop) throw new Response("Missing shop", { status: 400 });

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") || null;
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const collection = url.searchParams.get("collection") || "";
  const tag = url.searchParams.get("tag") || "";
  const sortKey = url.searchParams.get("sortKey") || "CREATED_AT";
  const direction = url.searchParams.get("direction") || "next"; // 기본은 next
  const isPrev = direction === "prev";

  
  const reverseParam = url.searchParams.get("reverse");
  const reverse = reverseParam === "false" ? false : true;



  const filters = [];
  if (search) filters.push(`${search}`);
  if (status) filters.push(`status:${status}`);
  //if (collection) filters.push(`collection:${collection}`);
  if (tag) filters.push(`tag:${tag}`);

  const queryString = filters.join(" AND ");
  //const limit = 25;
  const limitParam = 25;


  const variables = {
    cursor,
    limitParam,
    query: queryString || undefined,
    sortKey,
    reverse,
    ...(isPrev
      ? { before: cursor, last: limitParam }
      : { after: cursor, first: limitParam })
  };

  const productQuery = gql`
  query getProducts(
    $query: String
    $sortKey: ProductSortKeys!
    $reverse: Boolean!
    $after: String
    $before: String
    $first: Int
    $last: Int
  ) {
    products(
      query: $query
      sortKey: $sortKey
      reverse: $reverse
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
          descriptionHtml
          createdAt
          publishedAt
          collections(first: 10) {
            edges {
              node {
                title
              }
            }
          }
          images(first: 1) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                sku
                price
                barcode
                inventoryQuantity
                image {
                  url
                  altText
                }
              }
            }
          }
        }
      }
    }
  }
`;

  const metaQuery = gql`
    query getCollectionsAndTags {
      collections(first: 100) { edges { node { id title } } }
      productTags(first: 100) { edges { node } }
    }
  `;

  const [productRes, metaRes] = await Promise.all([
    admin.graphql(productQuery, { variables }),
    admin.graphql(metaQuery)
  ]);

  if (!productRes.ok || !metaRes.ok) {
    throw new Response("GraphQL query failed", { status: 500 });
  }

  const productsJson = await productRes.json();
  const metaJson = await metaRes.json();

  const data = productsJson.data.products;
  const products: Product[] = data.edges.map((edge: any) => {
    const p = edge.node;
    const variant = p.variants.edges[0]?.node || {};
    const collections = p.collections.edges.map((ce: any) => ce.node.title);
    const variantImage = variant.image?.url;
    const productImage = p.images.edges[0]?.node?.url;

    return {
      id: p.id,
      title: p.title,
      status: p.status,
      sku: variant.sku || "-",
      price: variant.price || "-",
      barcode: variant.barcode || "-",
      totalInventory: variant.inventoryQuantity ?? 0,
      image: variantImage || productImage || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-image.png",
      imageAlt: variant.image?.altText || p.images.edges[0]?.node?.altText || "No image",
      collections,
      descriptionHtml: p.descriptionHtml || "",
      cursor: edge.cursor,
      createdAt: p.createdAt,
      publishedAt: p.publishedAt
    };
  });

  const collectionOptions = metaJson.data.collections.edges.map((e: any) => ({
    label: e.node.title,
    value: e.node.id
  }));
  const tagOptions = metaJson.data.productTags.edges.map((e: any) => ({
    label: e.node,
    value: e.node
  }));

  return json<LoaderResponse>({
    products,
    pageInfo: data.pageInfo,
    shop,
    collectionOptions,
    tagOptions
  });
};

function SortableHeader({ title, value }: any) {
  const handleClick = () => {
    const params = new URLSearchParams(window.location.search);
    params.set("sortKey", value);
    window.location.search = params.toString();
  };
  return <button onClick={handleClick}>{title}</button>;
}

export default function ProductsPage() {
  const { products, pageInfo, shop, collectionOptions, tagOptions } = useLoaderData<LoaderResponse>();
    const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [collection, setCollection] = useState(searchParams.get("collection") || "");
  const filteredProducts = collection
  ? products.filter(p =>
      p.collections.includes(
        collectionOptions.find(c => c.value === collection)?.label || ""
      )
    )
  : products;
  const [tag, setTag] = useState(searchParams.get("tag") || "");
  const sortKey = searchParams.get("sortKey") || "CREATED_AT";

  const reverseParam = searchParams.get("reverse");
  const reverse = reverseParam === "false" ? false : true;

  const resourceState = useIndexResourceState(products);
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const headings = [
    { title: "Image" },
    { title: "Title", width: "9%" },
    { title: "Collections" },
    { title: "SKU" },
    { title: "Barcode" },
    { title: "Price" },
    { title: "Available Qty" },
    { title: "Status" },
    { title: "Created"},
    { title: "Published"},
    { title: "Description", width: "12%" }
  ];

  return (
    <Page title="Custom Products Page" fullWidth>
      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", padding: "1rem" }}>
              {/* 왼쪽: Search + Filter + 버튼 */}
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
               <TextField label="Search" value={search} onChange={setSearch} autoComplete="off" />
                <Select label="Status" options={[{ label: "All", value: "" }, { label: "Active", value: "ACTIVE" }, { label: "Draft", value: "DRAFT" }]} value={status} onChange={setStatus} />
                <Select label="Collection" options={[{ label: "All", value: "" }, ...collectionOptions]} value={collection} onChange={setCollection} />
                <Select label="Tag" options={[{ label: "All", value: "" }, ...tagOptions]} value={tag} onChange={setTag} />
                <Button onClick={() => {
                  const params: Record<string, string> = {};
                  if (search) params.search = search;
                  if (status) params.status = status;
                  if (collection) params.collection = collection;
                  if (tag) params.tag = tag;
                  setSearchParams(params);
                }} size="slim" variant="primary">Apply</Button>
                <Button onClick={() => {
                  setSearch(""); setStatus(""); setCollection(""); setTag("");
                  setSearchParams({});
                }} size="slim" variant="secondary">Clear</Button>
              </div>
              {/* 오른쪽: Sort */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
                <Select
                  label="Sort by"
                  options={[
                    { label: "Created Date", value: "CREATED_AT" },
                    { label: "Published Date", value: "PUBLISHED_AT" },
                    { label: "Title (A-Z)", value: "TITLE" }
                  ]}
                  value={sortKey}
                  onChange={(value) => {
                    const params = new URLSearchParams(window.location.search);
                    params.set("sortKey", value);

                    // 🔁 reverse는 현재 값 유지
                    const currentReverse = params.get("reverse");
                    if (!currentReverse) params.set("reverse", "true");

                    window.location.search = params.toString();
                  }}
                />

                <Button
                  size="slim"
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    const currentReverse = params.get("reverse") === "false" ? false : true;
                    const newReverse = (!currentReverse).toString();
                    params.set("reverse", newReverse);
                    window.location.search = params.toString(); // 🔁 페이지 리로드
                  }}
                >
                  {reverse ? "⬇️ Desc" : "⬆️ Asc"}
                </Button>
              </div>

            </div>
          </Card>

          <Card>
            {!isClient ? (
              <div style={{ padding: "2rem" }}>Loading...</div>
            ) : (
              <>
                <IndexTable
                  resourceName={{ singular: "product", plural: "products" }}
                  itemCount={filteredProducts.length}
                  selectedItemsCount={resourceState.allResourcesSelected ? "All" : resourceState.selectedResources.length}
                  onSelectionChange={resourceState.handleSelectionChange}
                  headings={headings.map(h => h.value ? { title: <SortableHeader title={h.title} value={h.value} />, ...(h.width && { width: h.width }) } : h)}
                >
                  {filteredProducts.map((p, index) => (
                    <IndexTable.Row id={p.id} key={p.id} selected={resourceState.selectedResources.includes(p.id)} position={index}>
                      <IndexTable.Cell><Thumbnail source={p.image} alt={p.imageAlt} /></IndexTable.Cell>
                      <IndexTable.Cell>
                        <div style={{ wordWrap: "break-word", whiteSpace: "normal" }}>
                          <a href={`https://${shop}/admin/products/${p.id.split("/").pop()}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#1a73e8", textDecoration: "underline", cursor: "pointer", display: "inline-block" }}>
                            {p.title}
                          </a>
                        </div>
                      </IndexTable.Cell>
                      <IndexTable.Cell>{p.collections.join(", ")}</IndexTable.Cell>
                      <IndexTable.Cell>{p.sku}</IndexTable.Cell>
                      <IndexTable.Cell>{p.barcode}</IndexTable.Cell>
                      <IndexTable.Cell>${p.price}</IndexTable.Cell>
                      <IndexTable.Cell>{p.totalInventory}</IndexTable.Cell>
                      <IndexTable.Cell>
                      <Badge
                          tone={
                            p.status === "ACTIVE"
                              ? "success"
                              : p.status === "DRAFT"
                              ? "info"
                              : p.status === "ARCHIVED"
                              ? "default"
                              : "warning"
                          }
                        >
                          {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                      </Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>{p.createdAt?.substring(0, 10)}</IndexTable.Cell>
                      <IndexTable.Cell>{p.publishedAt?.substring(0, 10)}</IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text variant="bodySm" as="span" color="subdued">
                          <div style={{ whiteSpace: "normal", wordWrap: "break-word" }}>
                            {p.descriptionHtml?.replace(/<[^>]+>/g, "")}
                          </div>
                        </Text>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>

                <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem", gap: "1rem" }}>
                  {pageInfo.hasPreviousPage && (
                    <Button onClick={() => {
                      const url = new URL(window.location.href);
                      url.searchParams.set("cursor", products[0].cursor || "");
                      url.searchParams.set("direction", "prev");
                      window.location.href = url.toString();
                    }} variant="secondary">⬅️ Prev</Button>
                  )}
                  {pageInfo.hasNextPage && filteredProducts.length === 25 && (
                    <Button onClick={() => {
                      const url = new URL(window.location.href);
                      url.searchParams.set("cursor", products[products.length - 1].cursor || "");
                      url.searchParams.set("direction", "next");
                      window.location.href = url.toString();
                    }} variant="primary">Next ➡️</Button>
                  )}
                </div>
              </>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
