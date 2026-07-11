// Home page — will render server-side from live API data (CMS hero slides,
// featured products, categories) once the catalogue endpoints are wired in
// Phase 2. Server component so product content is crawlable (organic search).
export default async function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero" style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
        <h1>Nethrasap</h1>
        <p>India&apos;s audited healthcare supply platform.</p>
        <p style={{ opacity: 0.7 }}>
          Storefront scaffold — pages are ported here from the Vite SPA against
          live API data. No mock data ships in this app.
        </p>
      </section>
    </main>
  );
}
