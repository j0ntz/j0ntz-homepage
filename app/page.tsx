import * as React from "react";

// Placeholder until the hero task lands: the name in the display face on the
// ground color, positioned where the contract puts it (top-left, off-centre),
// so the token set is visible on the preview.
const Home: React.FC = () => {
  return (
    <main className="flex min-h-dvh flex-col px-3 pt-rhythm md:px-10 md:pt-[calc(var(--rhythm)*3)]">
      <h1 className="font-display text-step-6 font-bold tracking-display text-foreground">
        Jonathan Tzeng
      </h1>
    </main>
  );
};

export default Home;
