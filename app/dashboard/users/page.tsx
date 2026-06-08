import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceByOwnerId, getEndUsersByWorkspace } from "@/db/queries";
import { redirect } from "next/navigation";
import { UserTable } from "@/components/UserTable";

export default async function UsersPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const workspace = await getWorkspaceByOwnerId(user.id);
  if (!workspace) redirect("/dashboard");

  const endUsers = await getEndUsersByWorkspace(workspace.id, 200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 text-sm mt-1">
          {endUsers.length} users tracked
        </p>
      </div>

      <UserTable users={endUsers} />
    </div>
  );
}
