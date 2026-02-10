import { Client, Environment } from "square";

const isProduction = process.env.SQUARE_ENVIRONMENT === "production";

export const square = new Client({
    environment: isProduction ? Environment.Production : Environment.Sandbox,
    accessToken: process.env.SQUARE_ACCESS_TOKEN || 'EAAAlwwZc986SOnGptz-rLM3GQe5DXnMFUs5hoSLMKI54TzaiM5x6DhlqR6GBNsn',
});
