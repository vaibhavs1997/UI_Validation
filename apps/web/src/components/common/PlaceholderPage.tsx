import { ActiveQaTarget } from '@/features/projects/components/ActiveQaTarget';

export function PlaceholderPage({ title }: Readonly<{ title: string }>) {
  return (
    <section>
      <p className="text-xs font-bold tracking-[0.2em] text-[#ad08d1]">VISIONQA MODULE</p>
      <h1 className="mt-3 text-3xl font-bold text-[#32133f]">{title}</h1>
      <p className="mt-3 text-[#76527f]">
        This surface is ready for API-backed workflows. Detector execution is
        intentionally not implemented in Phase 0.
      </p>
      <ActiveQaTarget />
    </section>
  );
}
