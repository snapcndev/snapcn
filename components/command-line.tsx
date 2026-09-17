import { CopyButton } from "@/components/docs/copy-button";
import { cn } from "@/lib/utils";

/**
 * One command, and a button that copies it.
 *
 * For the pages that hand somebody a line to paste rather than document one —
 * the free-sample link after confirming, and a buyer's key setup on `/pro`. The
 * docs' `CodeBlockCommand` is the package-manager-tabbed version of this, and
 * those lines are not package-manager commands.
 */
export function CommandLine({
  command,
  className,
  onCopy,
}: {
  command: string;
  className?: string;
  onCopy?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-left",
        className,
      )}
    >
      <code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-foreground text-xs leading-relaxed">
        {command}
      </code>
      <CopyButton value={command} className="shrink-0" onCopy={onCopy} />
    </div>
  );
}
