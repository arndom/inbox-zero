import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import { getGmailClient } from "@/utils/gmail/client";
import { queryBatchMessages } from "@/utils/gmail/message";
import { withError } from "@/utils/middleware";
import { SafeError } from "@/utils/error";
import { messageQuerySchema } from "@/app/api/google/messages/validation";

export type MessagesResponse = Awaited<ReturnType<typeof getMessages>>;

async function getMessages({
  query,
  pageToken,
}: {
  query?: string | null;
  pageToken?: string | null;
}) {
  const session = await auth();
  if (!session?.user.email) throw new SafeError("Not authenticated");
  if (!session.accessToken) throw new SafeError("Missing access token");

  const gmail = getGmailClient(session);

  const { messages, nextPageToken } = await queryBatchMessages(
    gmail,
    session.accessToken,
    {
      query: query?.trim(),
      maxResults: 20,
      pageToken: pageToken ?? undefined,
    },
  );

  // filter out messages from the user
  // NOTE: -from:me doesn't work because it filters out messages from threads where the user responded
  const incomingMessages = messages.filter(
    (message) => !message.headers.from.includes(session.user.email!),
  );

  return { messages: incomingMessages, nextPageToken };
}

export const GET = withError(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const pageToken = searchParams.get("pageToken");
  const r = messageQuerySchema.parse({ q: query, pageToken });
  const result = await getMessages({ query: r.q, pageToken: r.pageToken });
  return NextResponse.json(result);
});
