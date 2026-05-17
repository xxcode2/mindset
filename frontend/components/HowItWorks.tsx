export function HowItWorks() {
  const steps = [
    { n: "01", title: "Create or pick", body: "Spin up a YES/NO market in seconds, or join an existing one." },
    { n: "02", title: "Take a side", body: "Bet ETH on YES or NO. Odds shift live with each new bet." },
    { n: "03", title: "Resolver decides", body: "After close time, the chosen resolver settles the outcome on-chain." },
    { n: "04", title: "Winners split the pool", body: "Proportional payout from the entire pool minus a 1% protocol fee." },
  ];
  return (
    <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
      {steps.map((s) => (
        <div key={s.n} className="card !p-4">
          <p className="text-xs text-accent2 font-mono mb-1.5">{s.n}</p>
          <h3 className="font-semibold mb-1 text-sm">{s.title}</h3>
          <p className="text-xs text-white/55 leading-relaxed">{s.body}</p>
        </div>
      ))}
    </section>
  );
}
