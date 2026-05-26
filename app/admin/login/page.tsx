import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Redirect old /admin/login → unified /login page
export default function OldAdminLoginPage() {
  redirect("/login?from=/admin");
}
