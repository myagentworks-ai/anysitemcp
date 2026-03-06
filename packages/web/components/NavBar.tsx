"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/servers", label: "Servers" },
  { href: "/integrations", label: "Integrations" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b px-4 py-3 flex gap-4 text-sm">
      <Link href="/" className="font-semibold">
        AnySiteMCP
      </Link>
      {NAV_LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={active ? "font-bold text-gray-900" : "text-gray-500 hover:text-gray-900"}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
