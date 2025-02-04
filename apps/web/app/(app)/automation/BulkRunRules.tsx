"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModal, Modal } from "@/components/Modal";
import { SectionDescription } from "@/components/Typography";
import type { ThreadsResponse } from "@/app/api/google/threads/controller";
import type { ThreadsQuery } from "@/app/api/google/threads/validation";
import { LoadingContent } from "@/components/LoadingContent";
import { runAiRules } from "@/utils/queue/email-actions";
import { sleep } from "@/utils/sleep";
import { PremiumAlertWithData, usePremium } from "@/components/PremiumAlert";
import { SetDateDropdown } from "@/app/(app)/automation/SetDateDropdown";
import { dateToSeconds } from "@/utils/date";
import { Tooltip } from "@/components/Tooltip";
import { useThreads } from "@/hooks/useThreads";
import { useAiQueueState } from "@/store/ai-queue";

export function BulkRunRules() {
  const { isModalOpen, openModal, closeModal } = useModal();
  const [totalThreads, setTotalThreads] = useState(0);

  const { data, isLoading, error } = useThreads({ type: "inbox" });

  const queue = useAiQueueState();

  const { hasAiAccess, isLoading: isLoadingPremium } = usePremium();

  const [running, setRunning] = useState(false);

  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const abortRef = useRef<() => void>();

  return (
    <div>
      <Tooltip content="Bulk process emails">
        <Button type="button" size="icon" variant="outline" onClick={openModal}>
          <HistoryIcon className="size-4" />
          <span className="sr-only">Select emails to process</span>
        </Button>
      </Tooltip>
      <Modal
        isOpen={isModalOpen}
        hideModal={closeModal}
        title="Process Existing Inbox Emails"
      >
        <LoadingContent loading={isLoading} error={error}>
          {data && (
            <>
              <SectionDescription className="mt-2">
                This runs your rules on emails currently in your inbox (that
                have not been previously processed).
              </SectionDescription>

              {!!queue.size && (
                <SectionDescription className="mt-2 rounded-md border border-green-200 bg-green-50 px-2 py-1.5">
                  Progress: {totalThreads - queue.size}/{totalThreads} emails
                  completed
                </SectionDescription>
              )}
              <div className="mt-4">
                <LoadingContent loading={isLoadingPremium}>
                  {hasAiAccess ? (
                    <div className="flex flex-col space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <SetDateDropdown
                          onChange={setStartDate}
                          value={startDate}
                          placeholder="Set start date"
                          disabled={running}
                        />
                        <SetDateDropdown
                          onChange={setEndDate}
                          value={endDate}
                          placeholder="Set end date (optional)"
                          disabled={running}
                        />
                      </div>

                      <Button
                        type="button"
                        disabled={running || !startDate}
                        loading={running}
                        onClick={async () => {
                          if (!startDate) return;
                          setRunning(true);
                          abortRef.current = await onRun(
                            { startDate, endDate },
                            (count) =>
                              setTotalThreads((total) => total + count),
                            () => setRunning(false),
                          );
                        }}
                      >
                        Process Emails
                      </Button>
                      {running && (
                        <Button
                          variant="outline"
                          onClick={() => abortRef.current?.()}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  ) : (
                    <PremiumAlertWithData />
                  )}
                </LoadingContent>
              </div>

              <SectionDescription className="mt-4">
                You can also process specific emails by visiting the{" "}
                <Link
                  href="/mail"
                  target="_blank"
                  className="font-semibold hover:underline"
                >
                  Mail
                </Link>{" "}
                page.
              </SectionDescription>
            </>
          )}
        </LoadingContent>
      </Modal>
    </div>
  );
}

// fetch batches of messages and add them to the ai queue
async function onRun(
  { startDate, endDate }: { startDate: Date; endDate?: Date },
  incrementThreadsQueued: (count: number) => void,
  onComplete: () => void,
) {
  let nextPageToken = "";
  const LIMIT = 25;

  const startDateInSeconds = dateToSeconds(startDate);
  const endDateInSeconds = endDate ? dateToSeconds(endDate) : "";
  const q = `after:${startDateInSeconds} ${
    endDate ? `before:${endDateInSeconds}` : ""
  }`;

  let aborted = false;

  function abort() {
    aborted = true;
  }

  async function run() {
    for (let i = 0; i < 100; i++) {
      const query: ThreadsQuery = {
        type: "inbox",
        nextPageToken,
        limit: LIMIT,
        q,
      };
      const res = await fetch(
        `/api/google/threads?${new URLSearchParams(query as any).toString()}`,
      );
      const data: ThreadsResponse = await res.json();

      nextPageToken = data.nextPageToken || "";

      const threadsWithoutPlan = data.threads.filter((t) => !t.plan);

      incrementThreadsQueued(threadsWithoutPlan.length);

      runAiRules(threadsWithoutPlan, false);

      if (!nextPageToken || aborted) break;

      // avoid gmail api rate limits
      // ai takes longer anyway
      await sleep(threadsWithoutPlan.length ? 5_000 : 2_000);
    }

    onComplete();
  }

  run();

  return abort;
}
