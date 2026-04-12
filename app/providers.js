"use client";
// import { ModalProvider } from "@mantine/core/lib/components/Modal/Modal.context";
import { MantineProvider } from "@mantine/core";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { StoreProvider } from "../stores/StoreContext";
import { AppProvider } from "./components/AppContext";

export function Providers({ children }) {
    return (
        // <ColorSchemeProvider ...>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}>
            <MantineProvider withGlobalStyles withNormalizeCSS >
                {/* <ModalsProvider> */}
                    {/* <SpotlightProvider > */}
                        <AppProvider>
                            <StoreProvider>
                                {children}
                            </StoreProvider>
                        </AppProvider>
                    {/* </SpotlightProvider> */}
                {/* </ModalsProvider> */}
                {/* Notifications system */}
                {/* <Notifications /> */}
            </MantineProvider>
        </GoogleOAuthProvider>
        // </ColorSchemeProvider>
    );
}