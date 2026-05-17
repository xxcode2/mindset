"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";
import {
  CATEGORIES,
  COMPARATORS,
  CONTRACT_ADDRESS,
  TOKEN_ADDRESS,
  PRICE_RESOLVER_ADDRESS,
  PRICE_FEEDS,
  type CategoryIndex,
  type ComparatorIndex,
  erc20Abi,
  getFeedAddress,
  predictionMarketAbi,
  priceResolverAbi,
} from "@/lib/contract";
import { classNames } from "@/lib/utils";
import { pushToast } from "@/lib/toast";

const CAT_ICONS: Record<number, string> = {
  0: "⚙️", // Custom
  1: "📈", // Price
  2: "⚽", // Sports
  3: "🏛️", // Politics
  4: "💬", // Social
  5: "🪙", // Crypto
};

export default function CreatePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  // Category
  const [category, setCategory] = useState<CategoryIndex>(1); // Default to Price

  // Common fields
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [closesIn, setClosesIn] = useState("24");
  const [resolver, setResolver] = useState("");

  // Price-specific fields
  const [feedIndex, setFeedIndex] = useState(0); // index into PRICE_FEEDS
  const [comparator, setComparator] = useState<ComparatorIndex>(0); // GreaterThan
  const [threshold, setThreshold] = useState("");

  // TX state
  const approveTx = useWriteContract();
  const createTx = useWriteContract();
  const registerTx = useWriteContract();
  const approveMined = useWaitForTransactionReceipt({ hash: approveTx.data });
  const createMined = useWaitForTransactionReceipt({ hash: createTx.data });
  const registerMined = useWaitForTransactionReceipt({ hash: registerTx.data });

  // Check allowance for creation fee
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACT_ADDRESS] : undefined,
    query: { enabled: !!address },
  });
  const { data: creationFeeData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: predictionMarketAbi,
    functionName: "creationFee",
  });
  const allowance = (allowanceData as bigint | undefined) ?? 0n;
  const creationFee = (creationFeeData as bigint | undefined) ?? 5_000_000n; // fallback 5 USDC
  const needsApproval = creationFee > 0n && allowance < creationFee;

  // After createMarket succeeds for Price category, we need the marketId to call registerCondition.
  const [pendingRegister, setPendingRegister] = useState(false);

  // Handle approve success
  useEffect(() => {
    if (approveMined.isSuccess) {
      pushToast("Approval confirmed! Now creating market...", "success");
      approveTx.reset();
      refetchAllowance();
    }
  }, [approveMined.isSuccess]); // eslint-disable-line

  useEffect(() => {
    if (createMined.isSuccess && category === 1 && !pendingRegister) {
      // Price market created. Now register the Chainlink condition.
      // The newly created market ID = whatever was nextMarketId at time of creation.
      // Since this is sequential and we just got confirmed, we fetch it from the receipt logs.
      // Simpler: the return value is marketId. We can parse from logs.
      // Actually the simplest approach: read nextMarketId and subtract 1.
      setPendingRegister(true);
    }
  }, [createMined.isSuccess]); // eslint-disable-line

  useEffect(() => {
    if (pendingRegister && createMined.isSuccess) {
      // We need the market ID. Parse from MarketCreated event in the receipt.
      const receipt = createMined.data;
      if (!receipt) return;

      // Find MarketCreated event — first indexed topic after event sig is marketId
      const marketCreatedTopic = "0x"; // We'll just use nextMarketId - 1 approach instead
      // Simpler: read the first log's first indexed topic (marketId)
      const log = receipt.logs.find(
        (l) => l.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() && l.topics.length >= 2
      );
      if (!log) {
        pushToast("Could not find market ID from receipt", "error");
        setPendingRegister(false);
        router.push("/markets");
        return;
      }

      const marketId = BigInt(log.topics[1]!);
      const feed = getFeedAddress(PRICE_FEEDS[feedIndex]);
      if (!feed) {
        pushToast("Feed not available on this network", "error");
        setPendingRegister(false);
        router.push("/markets");
        return;
      }

      const decimals = PRICE_FEEDS[feedIndex].decimals;
      const thresholdRaw = BigInt(Math.round(Number(threshold) * 10 ** decimals));
      const maxStaleness = BigInt(3600); // 1 hour staleness window

      registerTx.writeContract({
        address: PRICE_RESOLVER_ADDRESS,
        abi: priceResolverAbi,
        functionName: "registerCondition",
        args: [marketId, feed, comparator, thresholdRaw, maxStaleness],
      });
    }
  }, [pendingRegister, createMined.isSuccess]); // eslint-disable-line

  useEffect(() => {
    if (registerMined.isSuccess) {
      pushToast("Price market created with auto-resolver!", "success");
      createTx.reset();
      registerTx.reset();
      setPendingRegister(false);
      setTimeout(() => router.push("/markets"), 600);
    }
  }, [registerMined.isSuccess]); // eslint-disable-line

  // For non-Price categories, just redirect after createMarket confirms
  useEffect(() => {
    if (createMined.isSuccess && category !== 1) {
      pushToast("Market created!", "success");
      createTx.reset();
      setTimeout(() => router.push("/markets"), 600);
    }
  }, [createMined.isSuccess, category]); // eslint-disable-line

  useEffect(() => {
    if (createTx.error) pushToast(createTx.error.message ?? "Transaction failed", "error");
    if (registerTx.error) pushToast(registerTx.error.message ?? "Register condition failed", "error");
    if (approveTx.error) pushToast(approveTx.error.message ?? "Approval failed", "error");
  }, [createTx.error, registerTx.error, approveTx.error]);

  // Auto-generate question for Price markets
  useEffect(() => {
    if (category === 1 && threshold) {
      const feed = PRICE_FEEDS[feedIndex];
      const cmpLabel = comparator === 0 ? ">" : comparator === 1 ? ">=" : comparator === 2 ? "<" : "<=";
      const formatted = Number(threshold).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
      setQuestion(`Will ${feed.symbol} be ${cmpLabel} ${formatted} at close time?`);
      setDescription(
        `Resolves automatically via Chainlink ${feed.name} price feed on Base. ` +
        `YES wins if the feed price is ${COMPARATORS[comparator].toLowerCase()} $${Number(threshold).toLocaleString()} ` +
        `at close time. Resolution is trustless — anyone can trigger it.`
      );
    }
  }, [category, feedIndex, comparator, threshold]); // eslint-disable-line

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) return pushToast("Connect your wallet first", "error");

    const q = question.trim();
    if (q.length === 0 || q.length > 280) return pushToast("Question is required (max 280 chars)", "error");
    const hours = Number(closesIn);
    if (!Number.isFinite(hours) || hours <= 0) return pushToast("Invalid duration", "error");

    // For Price category, validate price-specific fields
    if (category === 1) {
      if (!threshold || Number(threshold) <= 0) return pushToast("Enter a price threshold", "error");
      const feed = getFeedAddress(PRICE_FEEDS[feedIndex]);
      if (!feed) return pushToast("Selected feed not available on this network", "error");
    }

    // Resolver: for Price markets, always use ChainlinkPriceResolver
    const resolverAddr = category === 1
      ? PRICE_RESOLVER_ADDRESS
      : ((resolver.trim() || address) as `0x${string}`);

    if (!/^0x[a-fA-F0-9]{40}$/.test(resolverAddr)) return pushToast("Invalid resolver address", "error");

    // Step 1: If needs approval, do that first
    if (needsApproval) {
      approveTx.writeContract({
        address: TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, 2n ** 256n - 1n], // max approval
      });
      return;
    }

    // Step 2: Create market
    const closeTime = BigInt(Math.floor(Date.now() / 1000) + Math.round(hours * 3600));

    createTx.writeContract({
      address: CONTRACT_ADDRESS,
      abi: predictionMarketAbi,
      functionName: "createMarket",
      args: [q, description.trim(), closeTime, resolverAddr, category],
    });
  };

  const busy = approveTx.isPending || approveMined.isLoading || createTx.isPending || createMined.isLoading || registerTx.isPending || registerMined.isLoading;

  const buttonLabel = busy
    ? approveTx.isPending || approveMined.isLoading
      ? "Approving USDC…"
      : pendingRegister
      ? "Registering oracle condition…"
      : "Creating market…"
    : needsApproval
    ? "Approve USDC (for creation fee)"
    : category === 1
    ? "Create Price Market (2 txns)"
    : "Create Market";

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold" style={{ color: "#f1f5f9" }}>
          Create Market
        </h2>
        <p className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
          Launch a new YES/NO prediction market on Base.
        </p>
      </div>

      {!isConnected && (
        <div className="glass-card mb-6 p-6 text-center">
          <p className="mb-3 text-sm" style={{ color: "rgba(148,163,184,0.7)" }}>
            Connect your wallet to create a market.
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              setCategory(i as CategoryIndex);
              if (i !== 1) {
                setQuestion("");
                setDescription("");
              }
            }}
            className={classNames(
              "rounded-xl px-4 py-2.5 text-sm font-medium transition",
              category === i
                ? "border-[rgba(99,102,241,0.4)] bg-[rgba(99,102,241,0.15)] text-[#a5b4fc]"
                : "border-[rgba(148,163,184,0.15)] bg-transparent text-[rgba(148,163,184,0.6)] hover:text-white"
            )}
            style={{ borderWidth: 1, borderStyle: "solid" }}
          >
            <span className="mr-1.5">{CAT_ICONS[i]}</span>
            {cat}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="glass-card p-6 sm:p-8">
        <div className="space-y-6">

          {/* Price-specific fields */}
          {category === 1 && (
            <div className="rounded-xl p-4" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <p className="mb-4 text-xs font-semibold tracking-wider" style={{ color: "#a5b4fc" }}>
                CHAINLINK PRICE ORACLE — AUTO-RESOLVES
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium" style={{ color: "rgba(148,163,184,0.5)" }}>
                    ASSET
                  </label>
                  <select
                    value={feedIndex}
                    onChange={(e) => setFeedIndex(Number(e.target.value))}
                    className="input-field rounded-xl px-3 py-2.5 text-sm"
                  >
                    {PRICE_FEEDS.map((f, i) => {
                      const addr = getFeedAddress(f);
                      return (
                        <option key={i} value={i} disabled={!addr}>
                          {f.symbol} / USD{!addr ? " (n/a)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium" style={{ color: "rgba(148,163,184,0.5)" }}>
                    CONDITION
                  </label>
                  <select
                    value={comparator}
                    onChange={(e) => setComparator(Number(e.target.value) as ComparatorIndex)}
                    className="input-field rounded-xl px-3 py-2.5 text-sm"
                  >
                    {COMPARATORS.map((c, i) => (
                      <option key={i} value={i}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium" style={{ color: "rgba(148,163,184,0.5)" }}>
                    THRESHOLD (USD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    placeholder="80000"
                    className="input-field rounded-xl px-3 py-2.5 font-mono text-sm"
                  />
                </div>
              </div>
              <p className="mt-3 text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>
                After close time, anyone can trigger resolution by calling the contract. No manual intervention needed.
              </p>
            </div>
          )}

          <Field label="MARKET QUESTION" hint={`${question.length}/280`}>
            <input
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={280}
              placeholder={category === 1 ? "(auto-generated from oracle config)" : "Will X happen before Y?"}
              className="input-field rounded-xl px-4 py-3 text-sm"
              readOnly={category === 1 && !!threshold}
            />
          </Field>

          <Field label="DESCRIPTION (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Resolution criteria and context."
              className="input-field resize-none rounded-xl px-4 py-3 text-sm"
              readOnly={category === 1 && !!threshold}
            />
          </Field>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field label="CLOSES IN (HOURS)">
              <input
                type="number"
                required
                min={1}
                value={closesIn}
                onChange={(e) => setClosesIn(e.target.value)}
                className="input-field rounded-xl px-4 py-3 font-mono text-sm"
              />
            </Field>
            {category !== 1 && (
              <Field label="RESOLVER ADDRESS">
                <input
                  type="text"
                  value={resolver}
                  onChange={(e) => setResolver(e.target.value)}
                  placeholder={address ?? "0x…"}
                  className="input-field rounded-xl px-4 py-3 font-mono text-xs"
                />
              </Field>
            )}
            {category === 1 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium" style={{ color: "rgba(148,163,184,0.5)" }}>
                  RESOLVER
                </label>
                <div className="rounded-xl px-4 py-3 text-xs font-mono" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}>
                  ChainlinkPriceResolver (automatic)
                </div>
              </div>
            )}
          </div>
          {category !== 1 && (
            <p className="-mt-4 text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>
              The resolver decides YES or NO after close. Defaults to your address.
            </p>
          )}

          <div className="info-pill flex items-start gap-3 rounded-xl p-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
              {category === 1 ? (
                <><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></>
              ) : (
                <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>
              )}
            </svg>
            <div>
              <div className="mb-1 text-xs font-semibold" style={{ color: "#a5b4fc" }}>
                {category === 1 ? "Trustless auto-resolution" : "Non-custodial market"}
              </div>
              <div className="text-xs leading-relaxed" style={{ color: "rgba(148,163,184,0.6)" }}>
                {category === 1
                  ? "This market uses Chainlink price feeds for resolution. After close time, anyone can trigger the resolve — no human decides the outcome. If the feed is unavailable for 7 days, bettors can refund."
                  : "Bets are held by the smart contract, not by you. If the resolver fails to settle within 7 days of close, anyone can mark the market invalid and bettors get full refunds."}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy || !isConnected}
            className="btn-primary w-full rounded-xl py-3.5 text-base font-semibold"
          >
            {buttonLabel}
          </button>

          {category === 1 && (
            <p className="text-center text-xs" style={{ color: "rgba(148,163,184,0.35)" }}>
              Two transactions: 1) Create market 2) Register oracle condition
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-xs font-medium tracking-wider" style={{ color: "rgba(148,163,184,0.5)" }}>
          {label}
        </label>
        {hint && (
          <span className="text-xs font-mono" style={{ color: "rgba(148,163,184,0.35)" }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
