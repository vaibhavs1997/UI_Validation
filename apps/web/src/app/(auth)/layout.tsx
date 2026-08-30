export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <main className="auth-fluid-shell min-h-screen overflow-hidden"><div aria-hidden="true"><span className="fluid-orb fluid-orb-one" /><span className="fluid-orb fluid-orb-two" /><span className="fluid-orb fluid-orb-three" /></div><div className="relative z-10">{children}</div></main>;
}
