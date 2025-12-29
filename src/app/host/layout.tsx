import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { HostAuthProvider } from "@/app/host/_components/HostAuthProvider";

export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? verifyAuthToken(token) : null;
  if (!payload) redirect("/login");
  return (
    <HostAuthProvider user={{ id: payload.sub, email: payload.email }}>
      {children}
    </HostAuthProvider>
  );
}
