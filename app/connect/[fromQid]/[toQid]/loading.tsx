export default function Loading() {
  return (
    <main className="hc-public grid min-h-screen place-items-center px-4">
      <section className="hc-panel w-full max-w-xl rounded-[28px] border px-6 py-10 text-center">
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
