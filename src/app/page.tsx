"use client";

import dynamic from "next/dynamic";

const PDFEditor = dynamic(() => import("@/components/PDFEditor"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <PDFEditor />
    </main>
  );
}
