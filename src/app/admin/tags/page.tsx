import { redirect } from "next/navigation";

export default function OldTagsPage() {
  redirect("/admin/library/tags");
}
