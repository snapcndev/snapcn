"use client";

import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { CheckIcon, LinkIcon, RotateCcwIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useQueryStates } from "nuqs";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTrackEvent } from "@/lib/analytics";
import { type ComponentConfig, getDefaults } from "@/lib/customizer-config";
import { buildParsers } from "@/lib/customizer-params";
import {
  RenderedDemo,
  renderedDemoPoster,
  renderedDemoSrc,
} from "@/lib/rendered-demos";
import { CONFIGS } from "@/registry/__configs__";
import { ComponentCustomizer } from "./component-customizer";

/**
 * The Remotion player, its scene and the registry behind it — fetched only when
 * the reader asks for the live preview, never on load. That import is the whole
 * weight of a component page: the docs preview used to pull all 22 scenes and
 * Remotion before the first paint, for a widget whose default state is a video
 * of itself.
 */
const ComponentPreviewStage = dynamic(
  () => import("./component-preview-stage"),
  {
    ssr: false,
    // Same box the demo and the player both occupy, so swapping between them
    // never moves the page.
    loading: () => (
      <div className="surface-card aspect-video w-full rounded-2xl" />
    ),
  },
);

export function ComponentPreview({ name }: { name: string }) {
  const config = CONFIGS[name];

  if (!config) {
    return (
      <div className="not-prose mb-6 rounded-lg border border-fd-border p-4 text-sm text-fd-muted-foreground">
        Unknown component: <code>{name}</code>
      </div>
    );
  }

  return (
    <Suspense fallback={<PreviewSkeleton config={config} />}>
      <Preview name={name} config={config} />
    </Suspense>
  );
}

/**
 * The shape of the widget, at its real height.
 *
 * `useQueryStates` needs a Suspense boundary, so this is what the server sends
 * and what the reader sees until hydration. It used to be a single 1.9:1 box —
 * a fraction of the widget's actual height — and the swap moved everything
 * below it down the page. That was the page's entire CLS (0.578, five times the
 * "poor" threshold). The two parts that carry the height are exact here: the
 * same `aspect-video` frame, and one `h-11` pill per control in the same
 * responsive grid the customizer uses.
 */
function PreviewSkeleton({ config }: { config: ComponentConfig }) {
  return (
    <div className="not-prose mb-6 flex w-full animate-pulse flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="h-9 w-40 rounded-full bg-muted" />
        <div className="surface-card aspect-video w-full rounded-2xl" />
      </div>
      <div>
        <div className="flex items-center justify-between pt-4 pb-2">
          <div className="h-8 w-24 rounded-md bg-muted" />
          <div className="h-8 w-[4.25rem] rounded-md bg-muted" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.keys(config.controls).map((key) => (
            <div key={key} className="h-11 rounded-xl bg-control" />
          ))}
        </div>
      </div>
    </div>
  );
}

function Preview({ name, config }: { name: string; config: ComponentConfig }) {
  const trackEvent = useTrackEvent();
  const { parsers, urlKeys } = useMemo(
    () => buildParsers(name, config.controls),
    [name, config.controls],
  );
  const defaults = useMemo(
    () => getDefaults(config.controls),
    [config.controls],
  );

  const [values, setValues] = useQueryStates(parsers, {
    urlKeys,
    clearOnDefault: true,
    shallow: true,
  });

  const isDefault = useMemo(
    () => Object.entries(defaults).every(([k, v]) => values[k] === v),
    [defaults, values],
  );

  const code = useMemo(() => generateCode(config, values), [config, values]);

  // Which preview is mounted. The player wins as soon as there is something the
  // mp4 cannot show — a customised prop — or the reader asks for it outright. A
  // component with no rendered demo (nothing to stand in for it) goes straight
  // to the player, as it always did.
  const demoSrc = renderedDemoSrc(name);
  const poster = renderedDemoPoster(name);
  const [asked, setAsked] = useState(false);
  const [tab, setTab] = useState("preview");
  const setLive = () => setAsked(true);
  const live = asked || !isDefault || !demoSrc;

  const [copied, setCopied] = useState(false);
  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    trackEvent("customized_link_shared", { component: name });
    setTimeout(() => setCopied(false), 1500);
  };

  const handleReset = () => {
    setValues(null);
    trackEvent("customizer_reset", { component: name });
  };

  useEffect(() => {
    trackEvent("docs_component_viewed", { component: name });
  }, [name, trackEvent]);

  const customizeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  useEffect(() => {
    const timers = customizeTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);
  const handleCustomizeChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    const existing = customizeTimers.current.get(key);
    if (existing) clearTimeout(existing);
    customizeTimers.current.set(
      key,
      setTimeout(() => {
        trackEvent("component_customized", { component: name, prop: key });
        customizeTimers.current.delete(key);
      }, 500),
    );
  };

  return (
    <div className="not-prose mb-6 flex w-full flex-col gap-4">
      <Tabs
        value={tab}
        className="gap-3"
        // Controlled, because the Code panel is mounted whether or not it is
        // the visible one — and mounting it means highlighting in the browser,
        // which pulls Shiki's TSX grammar (175KB, ~1.5s of script evaluation on
        // a phone) for a panel nobody has opened.
        //
        // Reading the source before installing is also the shadcn-user tell
        // that separates browsing from evaluating.
        onValueChange={(value) => {
          setTab(value as string);
          if (value === "code")
            trackEvent("component_code_viewed", { component: name });
        }}
      >
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-0">
          {live ? (
            <ComponentPreviewStage name={name} values={values} />
          ) : (
            // The rendered mp4 of this component at its default props — the
            // same file the reader would ship, and the same thing the player
            // would draw. It is a <video>, not React re-rendering a scene at
            // 30fps, so it costs a decode instead of the entire Remotion
            // runtime. The moment anything is customised the file is wrong by
            // definition and the player takes over.
            <button
              type="button"
              onClick={setLive}
              aria-label={`Open the interactive preview of ${name}`}
              className="surface-card group relative block aspect-video w-full overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <RenderedDemo
                src={demoSrc as string}
                poster={poster ?? undefined}
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                  Play it live
                </span>
              </span>
            </button>
          )}
        </TabsContent>

        <TabsContent value="code" className="mt-0">
          <div className="surface-card overflow-hidden rounded-2xl [&_pre]:!rounded-none [&_pre]:!border-0 [&_pre]:!bg-transparent">
            {tab === "code" ? (
              <DynamicCodeBlock lang="tsx" code={code} />
            ) : (
              <div className="aspect-video w-full" />
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="overflow-hidden ">
        <div className="flex items-center justify-between pt-4 pb-2">
          <span className="text-sm font-medium text-foreground">Customize</span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleCopyLink}
              aria-label="Copy share link"
              title="Copy share link"
              className="text-muted-foreground hover:text-foreground"
            >
              {copied ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <LinkIcon className="size-3.5" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleReset}
              disabled={isDefault}
              aria-label="Reset to defaults"
              title="Reset to defaults"
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <RotateCcwIcon className="size-3.5" />
            </Button>
          </div>
        </div>
        <ComponentCustomizer
          controls={config.controls}
          values={values as Record<string, unknown>}
          onChange={handleCustomizeChange}
        />
      </div>
    </div>
  );
}

function generateCode(config: ComponentConfig, props: Record<string, unknown>) {
  if (config.snippet) return config.snippet(props);
  const propsString = Object.entries(props)
    .map(([k, v]) => {
      if (typeof v === "string") return `  ${k}="${v}"`;
      return `  ${k}={${JSON.stringify(v)}}`;
    })
    .join("\n");
  return `import { ${config.componentName} } from "${config.importPath}";

<${config.componentName}
${propsString}
/>`;
}
