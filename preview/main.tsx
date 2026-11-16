// Entry point of the in-Claude preview: the real screens, bundled as one page with an in-memory router.
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { ParamsContext, usePathname } from "./shims/navigation";
import { AppRoot } from "@/components/Shell";
import Home from "@/app/(app)/page";
import Campaigns from "@/app/(app)/campaigns/page";
import CampaignLayout from "@/app/(app)/campaigns/[id]/layout";
import CampaignIndex from "@/app/(app)/campaigns/[id]/page";
import Brief from "@/app/(app)/campaigns/[id]/brief/page";
import Build from "@/app/(app)/campaigns/[id]/build/page";
import Plan from "@/app/(app)/campaigns/[id]/plan/page";
import Library from "@/app/(app)/library/page";
import Calendar from "@/app/(app)/calendar/page";
import Reports from "@/app/(app)/reports/page";
import Settings from "@/app/(app)/settings/page";
import Print from "@/app/print/[id]/page";

function Routes() {
  const path = usePathname(); let m: RegExpMatchArray | null;
  const withId = (id: string, node: ReactNode) => <ParamsContext.Provider value={{ id }}>{node}</ParamsContext.Provider>;
  if ((m = path.match(/^\/print\/([^/]+)/))) return withId(m[1], <Print />);
  let page: ReactNode;
  if ((m = path.match(/^\/campaigns\/([^/]+)(?:\/(brief|build|plan))?$/))) page = withId(m[1], m[2] ? <CampaignLayout>{m[2] === "brief" ? <Brief /> : m[2] === "build" ? <Build /> : <Plan />}</CampaignLayout> : <CampaignIndex />);
  else page = path === "/campaigns" ? <Campaigns /> : path === "/library" ? <Library /> : path === "/calendar" ? <Calendar /> : path === "/reports" ? <Reports /> : path === "/settings" ? <Settings /> : <Home />;
  return <AppRoot>{page}</AppRoot>;
}
createRoot(document.getElementById("mp-root")!).render(<Routes />);
