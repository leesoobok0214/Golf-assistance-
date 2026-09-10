"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "홈", icon: HomeIcon },
  { href: "/scan", label: "스캔", icon: ScanIcon },
  { href: "/history", label: "기록", icon: ListIcon },
  { href: "/stats", label: "통계", icon: ChartIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-golf-200 bg-white/98 backdrop-blur-md safe-bottom">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1.5 pb-1.5">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-golf-100 text-golf-900"
                    : "text-golf-600 hover:text-golf-800"
                }`}
              >
                <Icon active={active} />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.18 : 0}
      />
    </svg>
  );
}

function ScanIcon({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="3"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
      />
      <path d="M3 12h18" stroke="currentColor" strokeWidth={active ? 2.4 : 2} />
      <circle
        cx="12"
        cy="12"
        r="2.5"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
      />
    </svg>
  );
}

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7h12M8 12h12M8 17h12"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinecap="round"
      />
      <circle cx="4" cy="7" r="1.4" fill="currentColor" />
      <circle cx="4" cy="12" r="1.4" fill="currentColor" />
      <circle cx="4" cy="17" r="1.4" fill="currentColor" />
    </svg>
  );
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19h16M7 16V10M12 16V6M17 16v-3"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinecap="round"
      />
    </svg>
  );
}
