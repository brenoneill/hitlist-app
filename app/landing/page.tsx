import { Landing } from "@/app/components/Landing";

/** Marketing page, reachable while signed in — unlike `/`, no auth redirect. */
export default function LandingPage() {
  return <Landing />;
}
