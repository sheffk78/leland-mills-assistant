/**
 * Landing page — redirects to /chat if authenticated, /login if not.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/chat");
  } else {
    redirect("/login");
  }
}