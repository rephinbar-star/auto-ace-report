export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function openRouterHeaders() {
  return {
    "Authorization": `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://carwise.expert",
    "X-Title": "CarWise",
  };
}
