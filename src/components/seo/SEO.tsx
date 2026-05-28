import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
  noIndex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_ORIGIN = "https://carwise.expert";

const defaultMeta = {
  title: "CarWise - Expert Car Buying Analysis & Fair Price Calculator",
  description:
    "AI-powered car buying analysis: fair price estimates, 5-year depreciation forecasts, and risk assessments for smarter vehicle purchases.",
  keywords:
    "car buying guide, used car analysis, fair car price, car depreciation calculator, vehicle value estimator, Carfax analysis",
  image: `${SITE_ORIGIN}/og-image.png`,
};

export function SEO({
  title,
  description = defaultMeta.description,
  keywords = defaultMeta.keywords,
  image = defaultMeta.image,
  url,
  type = "website",
  noIndex = false,
  jsonLd,
}: SEOProps) {
  const { pathname } = useLocation();
  const canonicalUrl = url ?? `${SITE_ORIGIN}${pathname}`;
  const pageTitle = title ? `${title} | CarWise` : defaultMeta.title;
  const trimmedDescription =
    description.length > 160 ? `${description.slice(0, 157).trimEnd()}...` : description;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{pageTitle}</title>
      <meta name="title" content={pageTitle} />
      <meta name="description" content={trimmedDescription} />
      <meta name="keywords" content={keywords} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={trimmedDescription} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={trimmedDescription} />
      <meta name="twitter:image" content={image} />

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Optional JSON-LD structured data */}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
