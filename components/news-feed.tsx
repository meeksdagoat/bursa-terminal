import { newsItems } from "@/lib/mock-data";

export function NewsFeed() {
  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-line bg-panel">
      <div className="flex h-7 items-center justify-between border-b border-line px-2.5">
        <h2 className="text-[10px] font-semibold tracking-[0.16em] text-amber-400/90 uppercase">
          Local News
        </h2>
        <span className="font-mono text-[9px] text-neutral-600">SAMPLE DATA</span>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto divide-y divide-line">
        {newsItems.map((item) => (
          <li key={item.headline} className="px-2.5 py-2 hover:bg-[#161616]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[9px] text-gain">{item.tag}</span>
              <span className="font-mono text-[9px] text-neutral-600">{item.time}</span>
            </div>
            <p className="mt-0.5 text-[12px] leading-snug text-neutral-100">{item.headline}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wider text-neutral-600">
              {item.source}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
