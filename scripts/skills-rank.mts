/**
 * Where snapcn's skills rank on skills.sh for the searches buyers type.
 *
 * skills.sh ranks a skill whose *name* matches the query far above its install
 * count — a 1k-install `remotion-video` sits above Remotion's own 552k skill for
 * "remotion video" — so the name is the lever and this is how we check it.
 * Run weekly: `node scripts/skills-rank.mts`.
 */
const QUERIES = [
  "remotion",
  "remotion video",
  "launch video",
  "product launch video",
  "product demo",
  "demo video",
  "motion graphics",
  "kinetic typography",
  "logo animation",
  "explainer video",
  "snapcn",
];

for (const q of QUERIES) {
  const res = await fetch(
    `https://skills.sh/api/search?q=${encodeURIComponent(q)}`,
  );
  const { skills = [] } = (await res.json()) as {
    skills?: { id: string; installs: number }[];
  };
  const ours = skills
    .map((s, i) => ({ ...s, rank: i + 1 }))
    .filter((s) => s.id.startsWith("snapcndev/"));
  const line = ours.length
    ? ours
        .map((s) => `#${s.rank} ${s.id.split("/").pop()} (${s.installs})`)
        .join(", ")
    : "not in results";
  console.log(`${q.padEnd(22)} ${line}`);
}
