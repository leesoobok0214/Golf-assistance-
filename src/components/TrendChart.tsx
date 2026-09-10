"use client";

interface Point {
  date: string;
  total: number;
  courseName: string;
}

export default function TrendChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-golf-300 bg-golf-50/50 px-4 py-10 text-center text-base font-medium text-golf-600">
        아직 추세를 그릴 데이터가 없어요
      </div>
    );
  }

  const totals = data.map((d) => d.total);
  const min = Math.min(...totals) - 2;
  const max = Math.max(...totals) + 2;
  const range = Math.max(max - min, 1);
  const w = 320;
  const h = 140;
  const padX = 12;
  const padY = 16;

  const points = data.map((d, i) => {
    const x =
      data.length === 1
        ? w / 2
        : padX + (i / (data.length - 1)) * (w - padX * 2);
    const y = padY + (1 - (d.total - min) / range) * (h - padY * 2);
    return { x, y, ...d };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area =
    `${points[0].x},${h - 4} ` +
    polyline +
    ` ${points[points.length - 1].x},${h - 4}`;

  return (
    <div className="rounded-2xl border border-golf-200 bg-white p-3 shadow-card">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" role="img" aria-label="스코어 추세">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#45a154" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#45a154" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={w - padX}
            y1={padY + t * (h - padY * 2)}
            y2={padY + t * (h - padY * 2)}
            stroke="#e3f5e6"
            strokeWidth="1"
          />
        ))}
        <polygon points={area} fill="url(#trendFill)" />
        <polyline
          points={polyline}
          fill="none"
          stroke="#348442"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#2c6937" strokeWidth="2" />
            <title>{`${p.date} · ${p.courseName} · ${p.total}타`}</title>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-1 text-xs font-semibold text-golf-600">
        <span>{data[0].date}</span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </div>
  );
}
