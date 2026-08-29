export function PlaceholderPage({ title }: Readonly<{ title: string }>) {
  return (
    <section>
      <p style={{ color: '#64708a' }}>VISIONQA MODULE</p>
      <h1>{title}</h1>
      <p>
        This surface is ready for API-backed workflows. Detector execution is
        intentionally not implemented in Phase 0.
      </p>
    </section>
  );
}
