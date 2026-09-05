import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Instrument_Sans,
  JetBrains_Mono,
} from "next/font/google";
import * as React from "react";

import "./globals.css";

// The three faces from docs/design-system.md, self-hosted by next/font from
// Google Fonts. Each exposes one CSS variable that app/globals.css wraps in a
// full fallback stack (--font-display, --font-body, --font-mono).
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  display: "swap",
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: "500",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jonathan Tzeng",
  description: "Jonathan Tzeng: the projects, the code, and where to reach him.",
};

const RootLayout: React.FC<LayoutProps<"/">> = ({ children }) => {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${instrument.variable} ${jetbrains.variable}`}
    >
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;
