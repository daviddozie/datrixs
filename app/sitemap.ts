import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://datrixs.vercel.app"

    return [
        {
            url: appUrl,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 1,
        },
    ]
}
