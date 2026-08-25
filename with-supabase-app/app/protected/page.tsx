import { redirect } from "next/navigation";

export default function ProtectedPage() {
  // The Starter ships this page as an authenticated-showcase ("Your user
  // details", "Next steps", create-table demo). This app uses the home page
  // ("/") as the only post-login destination, so any stale link to
  // /protected immediately bounces users back.
  redirect("/");
}
