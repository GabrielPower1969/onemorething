import type { APIRoute } from "astro";
import { sitemap } from "../lib/feeds";

export const GET: APIRoute = () => sitemap();
