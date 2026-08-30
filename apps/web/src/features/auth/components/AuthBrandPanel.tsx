const features = ['Visual & responsive validation', 'Broken links and resources', 'Crawling and site structure', 'Accessibility and SEO', 'Browser and network checks'];

export function AuthBrandPanel() {
  return <section className="glass-brand-panel relative hidden min-h-[720px] overflow-hidden rounded-[28px] px-10 py-12 text-white shadow-[0_24px_70px_rgba(67,18,80,0.28)] lg:flex lg:flex-col lg:justify-between xl:px-16">
    <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />
    <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full border border-white/10" />
    <div className="relative"><div className="flex items-center gap-3 text-xl font-bold tracking-[-0.03em]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ad08d1] text-sm">V</span> VisionQA</div><div className="mt-24 max-w-lg"><p className="mb-5 text-xs font-bold uppercase tracking-[0.24em] text-[#e39bef]">Release confidence, built in</p><h1 className="max-w-md text-4xl font-semibold leading-[1.12] tracking-[-0.04em] xl:text-5xl">Automated website quality assurance for every release.</h1><p className="mt-6 max-w-md text-base leading-7 text-[#b4bfd8]">Catch regressions before your customers do with one dependable QA workspace.</p></div></div>
    <div className="relative space-y-4 text-sm text-[#d9e0f1]">{features.map((feature) => <div key={feature} className="flex items-center gap-3"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4d155c] text-xs text-[#e39bef]">✓</span>{feature}</div>)}</div>
  </section>;
}
