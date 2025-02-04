"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { MessageText } from "@/components/Typography";
import { getGmailUrl } from "@/utils/url";
import { decodeSnippet } from "@/utils/gmail/decode";
import { ViewEmailButton } from "@/components/ViewEmailButton";

export function TestRulesMessage({
  from,
  userEmail,
  subject,
  snippet,
  threadId,
  messageId,
}: {
  from: string;
  userEmail: string;
  subject: string;
  snippet: string;
  threadId: string;
  messageId: string;
}) {
  return (
    <div className="min-w-0 break-words">
      <MessageText className="flex items-center">
        {from}{" "}
        <Link
          className="ml-2 hover:text-gray-900"
          href={getGmailUrl(messageId, userEmail)}
          target="_blank"
        >
          <ExternalLinkIcon className="h-4 w-4" />
        </Link>
        <ViewEmailButton
          threadId={threadId}
          messageId={messageId}
          size="xs"
          className="ml-1.5"
        />
      </MessageText>
      <MessageText className="mt-1 font-bold">{subject}</MessageText>
      <MessageText className="mt-1">
        {decodeSnippet(snippet).trim()}
      </MessageText>
    </div>
  );
}
