import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { ArrowRight } from "lucide-react";
import { CommandBar, CommandBrand, CommandNav, type CommandNavItem } from "../components/layout/CommandBar.tsx";
import { Link } from "../lib/router.tsx";

type NavId = "home" | "features" | "how-it-works" | "security";

const NAV: readonly CommandNavItem<NavId>[] = [
  { id: "home", label: "Home", href: "#overview" },
  { id: "features", label: "Features", href: "#problem" },
  { id: "how-it-works", label: "How It Works", href: "#how-it-works" },
  { id: "security", label: "Security", href: "#security" },
];

/** Page section → the nav item that stays marked while it is on screen. */
const NAV_FOR_SECTION: Record<string, NavId> = {
  overview: "home",
  problem: "features",
  "how-it-works": "how-it-works",
  sandbox: "how-it-works",
  showcase: "how-it-works",
  security: "security",
};

export interface LandingHeaderProps {
  /** Id of the page section currently in view. */
  activeSection: string | null;
}

/** The Cyber-Glass command bar: brand, section links with the sliding mint pill, and the Launch Studio action. */
export function LandingHeader({ activeSection }: LandingHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const active: NavId = activeSection ? (NAV_FOR_SECTION[activeSection] ?? "home") : "home";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={clsx("landing-header", scrolled && "is-scrolled")}>
      <div className="landing-container py-3.5">
        <CommandBar>
          <a href="#overview" className="cyber-brand" aria-label="SpecShield QA — back to top">
            <CommandBrand wordClassName="max-[359px]:hidden" />
          </a>
          <CommandNav label="Page sections" items={NAV} activeId={active} className="mx-auto hidden md:flex" />
          <Link to="/studio" className="cta-matrix cta-matrix-compact ml-auto md:ml-0">
            Launch Studio
            <ArrowRight size={14} aria-hidden />
          </Link>
        </CommandBar>
      </div>
    </header>
  );
}
