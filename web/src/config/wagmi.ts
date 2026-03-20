import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, baseSepolia } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "Shade",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "shade-dev-placeholder",
  chains: [baseSepolia, base],
  ssr: true,
});
