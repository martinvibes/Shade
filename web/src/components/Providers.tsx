"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { config } from "@/config/wagmi";
import "@rainbow-me/rainbowkit/styles.css";

const shadeTheme = darkTheme({
  accentColor: "#D4A853",
  accentColorForeground: "#09090B",
  borderRadius: "medium",
  fontStack: "system",
});

shadeTheme.colors.connectButtonBackground = "#131316";
shadeTheme.colors.connectButtonInnerBackground = "#1C1C21";
shadeTheme.colors.connectButtonText = "#FAFAFA";
shadeTheme.colors.modalBackground = "#131316";
shadeTheme.colors.modalBorder = "#27272A";
shadeTheme.colors.modalText = "#FAFAFA";
shadeTheme.colors.modalTextSecondary = "#A1A1AA";
shadeTheme.colors.profileForeground = "#131316";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config} reconnectOnMount>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={shadeTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
