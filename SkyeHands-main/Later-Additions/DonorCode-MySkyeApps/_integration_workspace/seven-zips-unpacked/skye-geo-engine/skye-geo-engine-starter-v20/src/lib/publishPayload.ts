export type PublishRequest = {
  platform: "wordpress" | "webflow" | "shopify" | "wix" | "ghost" | "generic-api";
  article: {
    title: string;
    slug: string;
    excerpt?: string;
    bodyHtml: string;
    jsonLd?: string;
    tags?: string[];
  };
};

export function buildPublishPayload(input: PublishRequest): unknown {
  const { platform, article } = input;
  const tags = article.tags || [];

  if (platform === "wordpress") {
    return {
      endpoint: "/wp-json/wp/v2/posts",
      method: "POST",
      payload: {
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt || "",
        status: "draft",
        content: `${article.bodyHtml}\n${article.jsonLd ? `\n<script type=\"application/ld+json\">${article.jsonLd}</script>` : ""}`,
        tags
      }
    };
  }

  if (platform === "webflow") {
    return {
      endpoint: "/collections/:collection_id/items",
      method: "POST",
      payload: {
        isDraft: true,
        isArchived: false,
        fieldData: {
          name: article.title,
          slug: article.slug,
          summary: article.excerpt || "",
          "post-body": article.bodyHtml,
          tags,
          schema_json_ld: article.jsonLd || ""
        }
      }
    };
  }


  if (platform === "wix") {
    return {
      endpoint: "/blog/v3/draft-posts",
      method: "POST",
      payload: {
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt || "",
        richContent: {
          nodes: [
            { type: "PARAGRAPH", id: "body-1", nodes: [], textData: { text: article.excerpt || article.title, decorations: [] } },
            { type: "HTML", id: "body-html", htmlData: { html: article.bodyHtml } }
          ]
        },
        heroImage: null,
        tagIds: tags,
        seoData: article.jsonLd ? { schemaMarkup: article.jsonLd } : undefined
      }
    };
  }

  if (platform === "ghost") {
    return {
      endpoint: "/ghost/api/admin/posts/?source=html",
      method: "POST",
      payload: {
        posts: [
          {
            title: article.title,
            slug: article.slug,
            html: article.bodyHtml,
            excerpt: article.excerpt || "",
            status: "draft",
            tags
          }
        ]
      }
    };
  }

  if (platform === "shopify") {
    return {
      endpoint: "/admin/api/2025-10/blogs/:blog_id/articles.json",
      method: "POST",
      payload: {
        article: {
          title: article.title,
          handle: article.slug,
          summary_html: article.excerpt || "",
          body_html: article.bodyHtml,
          tags: tags.join(", "),
          metafields: article.jsonLd
            ? [
                {
                  namespace: "seo",
                  key: "json_ld",
                  type: "multi_line_text_field",
                  value: article.jsonLd
                }
              ]
            : []
        }
      }
    };
  }

  return {
    endpoint: "/content/publish",
    method: "POST",
    payload: {
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt || "",
      html: article.bodyHtml,
      schemaJsonLd: article.jsonLd || "",
      tags
    }
  };
}
