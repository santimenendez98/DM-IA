import React from "react";
import { GlobalLoader } from "@/components/GlobalLoader";
import "./globals.css";

export const metadata = {
  title: "Hearth & Hall",
  description: "Portal de campañas y personajes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head />
      <body>
        <GlobalLoader />
        {children}
      </body>
    </html>
  );
}
