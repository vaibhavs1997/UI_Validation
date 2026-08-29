import Link from 'next/link';
export default function HomePage() {
  return (
    <main style={{ padding: 64 }}>
      <h1>VisionQA</h1>
      <p>Modular website QA scanning for reliable releases.</p>
      <Link href="/dashboard/dashboard">Open dashboard →</Link>
    </main>
  );
}
