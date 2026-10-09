import { redirect } from "next/navigation";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { getSession } from "@/lib/auth";
import { parseAuthorizeRequest } from "@/lib/mcp-oauth";

// Consent screen for an MCP client (claude.ai, Claude Code, …) asking to act
// as the signed-in user. Reached only via GET /api/oauth/authorize, which has
// already sent signed-out users through sign-in.

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ConsentPage({ searchParams }: Props) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") params.set(k, v);

  const user = await getSession();
  if (!user) redirect(`/api/oauth/authorize?${params}`);

  const parsed = parseAuthorizeRequest(params);
  if (!parsed.ok) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <Text type="supporting">Can&apos;t connect: {parsed.error}</Text>
      </main>
    );
  }
  const { client, redirectUri } = parsed.req;
  const destination = new URL(redirectUri).host;

  const hidden = [...params.entries()].map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <Text type="label" display="block" className="mb-2">Connect to Job Search</Text>
          <Text display="block" className="mb-4">
            <strong>{client.name}</strong> wants to access your job search as{" "}
            <strong>{user.email}</strong>.
          </Text>
          <Text type="supporting" display="block" className="mb-2">It will be able to:</Text>
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-secondary">
            <li>Read your jobs, notes, resumes, and candidate profile</li>
            <li>Add and update jobs, notes, resumes, and submissions</li>
            <li>Run ATS match and fitness checks</li>
          </ul>
          <Text type="supporting" display="block" className="mb-5">
            You&apos;ll be sent back to <code className="text-xs">{destination}</code>. Disconnect any
            time from Profile → AI.
          </Text>
          {/* Astryx Button defaults to type="button" — submit must be explicit. */}
          <form action="/api/oauth/authorize" method="POST" className="flex gap-2">
            {hidden}
            <Button type="submit" name="decision" value="allow" label="Allow" variant="primary" />
            <Button type="submit" name="decision" value="deny" label="Cancel" variant="secondary" />
          </form>
        </div>
      </Card>
    </main>
  );
}
