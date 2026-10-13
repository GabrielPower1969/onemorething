import type { APIRoute } from "astro";
import { rss } from "../lib/feeds";

export const GET: APIRoute = () => rss("en");
