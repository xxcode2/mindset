export function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Stake on yourself",
      body: "Lock ETH into the contract for a habit you commit to. Only the contract holds it.",
    },
    {
      n: "02",
      title: "Check in daily",
      body: "Sign one transaction per day. Streak is tracked transparently on-chain.",
    },
    {
      n: "03",
      title: "Hit target → claim",
      body: "Reach your required check-ins before the deadline and pull every wei back.",
    },
    {
      n: "04",
      title: "Miss target → charity",
      body: "If the deadline passes unmet, the stake is forwarded to a fixed charity address.",
    },
  ];
  return (
    <section className="grid gap-3 md:grid-cols-4">
      {steps.map((s) => (
        <div key={s.n} className="card">
          <p className="text-xs text-accent2 font-mono mb-2">{s.n}</p>
          <h3 className="font-semibold mb-1">{s.title}</h3>
          <p className="text-sm text-white/55 leading-relaxed">{s.body}</p>
        </div>
      ))}
    </section>
  );
}
