"use client";

import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Labels = {
  open: string;
  title: string;
  text: string;
  reasonsLegend: string;
  reasons: { value: string; label: string }[];
  details: string;
  submit: string;
  /** Shown until the backend endpoint exists (#33); nothing is sent yet. */
  unavailable: string;
  close: string;
};

/** Complaint form UI. Submitting is disabled until the moderation API exists. */
export function ReportDialog({ labels }: { labels: Labels }) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="ghost" size="sm" className="self-start text-muted-foreground" />}
      >
        <Flag aria-hidden />
        {labels.open}
      </DialogTrigger>
      <DialogContent closeLabel={labels.close}>
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.text}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">{labels.reasonsLegend}</legend>
            {labels.reasons.map((r, i) => (
              <label key={r.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  defaultChecked={i === 0}
                  className="size-4 accent-primary"
                />
                {r.label}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-sm">
            {labels.details}
            <textarea
              name="details"
              rows={3}
              maxLength={1000}
              className="rounded-md border border-input bg-background p-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <p className="text-sm text-muted-foreground">{labels.unavailable}</p>
          <DialogFooter>
            <Button type="submit" disabled>
              {labels.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
