import { redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { FeedbackPortal } from "@/components/FeedbackPortal";

export default async function FeedbackPage() {
  const { workspace } = await getActiveWorkspace();

  if (!workspace) redirect("/login");

  return <FeedbackPortal />;
}
