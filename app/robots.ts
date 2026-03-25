import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://datrixs.vercel.app"

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/api/", "/_next/"],
            },
            // Allow AI crawlers explicitly
            {
                userAgent: "GPTBot",
                allow: "/",
            },
            {
                userAgent: "Claude-Web",
                allow: "/",
            },
            {
                userAgent: "PerplexityBot",
                allow: "/",
            },
            {
                userAgent: "Applebot",
                allow: "/",
            },
        ],
        sitemap: `${appUrl}/sitemap.xml`,
        host: appUrl,
    }
}
