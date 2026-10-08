export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f5ef] px-4 text-[#15213b]">
      <section className="w-full max-w-xl rounded-[28px] border border-[#e1e5eb] bg-white/80 px-6 py-10 text-center shadow-[0_20px_70px_rgba(20,30,50,0.08)]">
        <div className="mx-auto flex w-fit items-center gap-3" aria-hidden="true">
          <span className="size-3 animate-pulse rounded-full bg-[#ff6846]" />
          <span className="size-3 animate-pulse rounded-full bg-[#f3b84b]" />
          <span className="size-3 animate-pulse rounded-full bg-[#42ad8d]" />
        </div>
        <p className="mt-5 text-base font-bold">Finding this connection...</p>
      </section>
    </main>
  );
}
