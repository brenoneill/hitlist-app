import type { Metadata } from "next";
import { PreviewBranchesInfo } from "@/app/components/PreviewBranchesInfo";

export const metadata: Metadata = {
  title: "Preview branches · HitList",
  description:
    "What preview branches are, why they matter for phone review in HitList, and how to set them up so Open preview appears on each PR.",
};

/** Public help page linked from the PR tab when no preview deployment exists. */
export default function PreviewBranchesPage() {
  return <PreviewBranchesInfo />;
}
