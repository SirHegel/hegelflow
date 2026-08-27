import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "Gestión multiusuario de trabajo con Scrum, Kanban, reportes y trazabilidad.";

export const metadata: Metadata = {
  metadataBase: new URL("https://hegelflow.vercel.app"),
  title: {
    default: "HegelFlow",
    template: "%s · HegelFlow",
  },
  description,
  applicationName: "HegelFlow",
  keywords: [
    "gestión de proyectos",
    "Scrum",
    "Kanban",
    "sprints",
    "tablero de tareas",
  ],
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: "/",
    siteName: "HegelFlow",
    title: "HegelFlow · Scrum y Kanban en un solo flujo",
    description,
    images: [{
      url: "/screenshots/dashboard-demo.png",
      width: 1440,
      height: 1000,
      alt: "Resumen de HegelFlow con datos ficticios de demostración",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HegelFlow · Scrum y Kanban en un solo flujo",
    description,
    images: ["/screenshots/dashboard-demo.png"],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
