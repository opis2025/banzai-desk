import {
  Card,
  Page,
  Layout,
  Button,
  IndexTable,
  useIndexResourceState,
} from "@shopify/polaris";
import { json, LoaderFunction } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { gql } from "graphql-request";
import { authenticate } from "../shopify.server";

interface ProductInfo {
  id: string;
  title: string;
  status: string;
  totalInventory: number;
  createdAt: string;
  image?: string;
  sku?: string;
}

type DashboardMetrics = {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  outOfStock: number;
  lowStock: number;
  recentProducts: ProductInfo[];
  lowStockProducts: ProductInfo[];
  recentDrafts: ProductInfo[];
};

export const loader: LoaderFunction = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // 1. 최근 등록된 제품 5개
  const recentProductsQuery = gql`
    {
      products(first: 5, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            title
            status
            totalInventory
            createdAt
            images(first: 1) {
              edges { node { transformedSrc } }
            }
            variants(first: 1) {
              edges { node { sku } }
            }
          }
        }
      }
    }
  `;

  // 2. Low Stock (재고 ≤ 5) 제품 최대 20개 가져오기 (JS 정렬 후 상위 5개만 사용)
  const lowStockQuery = gql`
    {
      products(first: 20, query: "inventory_total:<6") {
        edges {
          node {
            id
            title
            status
            totalInventory
            createdAt
            images(first: 1) {
              edges { node { transformedSrc } }
            }
            variants(first: 1) {
              edges { node { sku } }
            }
          }
        }
      }
    }
  `;

  // 3. Draft 상태 제품 5개
  const draftQuery = gql`
    {
      products(first: 5, query: "status:draft", sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            title
            status
            totalInventory
            createdAt
            images(first: 1) {
              edges { node { transformedSrc } }
            }
            variants(first: 1) {
              edges { node { sku } }
            }
          }
        }
      }
    }
  `;

  // 병렬 요청 처리
  const [recentResp, lowStockResp, draftResp] = await Promise.all([
    admin.graphql(recentProductsQuery).then(res => res.json()),
    admin.graphql(lowStockQuery).then(res => res.json()),
    admin.graphql(draftQuery).then(res => res.json()),
  ]);

  // 포맷 함수
  const formatProducts = (edges: any[]): ProductInfo[] =>
    edges.map((edge) => {
      const p = edge.node;
      return {
        id: p.id.split("/").pop(),
        title: p.title,
        status: p.status,
        totalInventory: p.totalInventory,
        createdAt: p.createdAt,
        image: p.images.edges?.[0]?.node?.transformedSrc ?? undefined,
        sku: p.variants.edges?.[0]?.node?.sku ?? undefined,
      };
    });

  const recentProducts = formatProducts(recentResp.data.products.edges);

  const lowStockProducts = formatProducts(lowStockResp.data.products.edges)
    .sort((a, b) => a.totalInventory - b.totalInventory)
    .slice(0, 5);

  const recentDrafts = formatProducts(draftResp.data.products.edges);

  return json({
    metrics: {
      recentProducts,
      lowStockProducts,
      recentDrafts,
    },
  });
};



export default function BanzaiDashboard() {
  const { metrics } = useLoaderData<{ metrics: DashboardMetrics }>();
  const navigate = useNavigate();

  const renderTable = (
    title: string,
    products: ProductInfo[],
    buttonText: string,
    buttonLink: string
  ) => {
    const resourceState = useIndexResourceState(products);

    return (
      <Card sectioned>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px"
        }}>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", margin: 0 }}>{title}</h2>
          <Button plain onClick={() => navigate(buttonLink)}>{buttonText}</Button>
        </div>
        <IndexTable
          resourceName={{ singular: "product", plural: "products" }}
          itemCount={products.length}
          selectedItemsCount={resourceState.selectedResources.length}
          onSelectionChange={resourceState.handleSelectionChange}
          headings={[
            { title: "Image" },
            { title: "Title" },
            { title: "SKU" },
            { title: "Status" },
            { title: "Inventory" },
          ]}
          selectable={false}
        >
          {products.map((p, index) => (
            <IndexTable.Row id={p.id} key={p.id} position={index}>
              <IndexTable.Cell>
                {p.image ? (
                  <img src={p.image} width={40} height={40} style={{ objectFit: "cover" }} />
                ) : (
                  "-"
                )}
              </IndexTable.Cell>
              <IndexTable.Cell>{p.title}</IndexTable.Cell>
              <IndexTable.Cell>{p.sku ?? "-"}</IndexTable.Cell>
              <IndexTable.Cell>{p.status}</IndexTable.Cell>
              <IndexTable.Cell>{p.totalInventory}</IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>
    );
  };

  return (
    <Page title="Banzai Apps Dashboard">
      <Layout>
        {/* Section 1: 앱 소개 */}
        <Layout.Section>
          <Card sectioned>
            <div style={{ padding: "24px", backgroundColor: "#eef4fa", borderRadius: "8px" }}>
              <p style={{ fontSize: "20px", fontWeight: "bold", color: "#1a1a1a", marginBottom: "12px" }}>
                📌 Key Features of This App
              </p>
              <ul style={{ fontSize: "15px", lineHeight: "1.6", color: "#333", paddingLeft: "20px", margin: 0 }}>
                <li>Product listings are tailored to Banzai’s specific needs, making it easier to manage important product information.</li>
                <li>Inventory filtering is customized to Banzai’s workflow, allowing for quick and efficient inventory control.</li>
                <li>Draft items are separated and highlighted, enabling faster review and launch of new products.</li>
              </ul>
            </div>
          </Card>
        </Layout.Section>

        {/* Section 3: 테이블 리스트 (링크 제거됨) */}
        <Layout.Section oneThird>
          {renderTable("Recent Products", metrics.recentProducts, "Go to Custom Products Page", "/app/products")}
        </Layout.Section>

        <Layout.Section oneThird>
          {renderTable("Low Stock Items", metrics.lowStockProducts, "Go to Custom Inventory Page", "/app/inventory")}
        </Layout.Section>

        <Layout.Section oneThird>
          {renderTable("Draft Items", metrics.recentDrafts, "Go to Draft Products Page", "/app/draftitems")}
        </Layout.Section>
      </Layout>
      <div style={{ height: "48px" }} /> {/* 하단 여백 */}
    </Page>
  );
}
