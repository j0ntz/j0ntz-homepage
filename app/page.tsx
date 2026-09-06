import * as React from "react";

import { GraphSnapshot } from "@/components/GraphSnapshot";
import { RepoGraph } from "@/components/RepoGraph";
import graphJson from "@/content/graph.json";
import site from "@/content/site.json";
import {
  desktopNominalSquarePx,
  mobileNominalSquarePx,
  selectNodes,
} from "@/lib/graph-scene";
import { isGraphData, type GraphData, type GraphNode } from "@/lib/graph-types";

// Zone 1 of the one page. Desktop: the graph full-bleed, the name and the
// one line top-left, the three links top-right, the call to action
// bottom-left. Mobile (below 768px): the name block first with nothing
// behind it, then the graph as its own full-width square. The graph is
// server-rendered as SVG so it is in the first painted frame; the live
// scene takes over on the client. Zones 2 and 3 are stubs here.

const graph = loadGraph(graphJson);
const maxCommits = Math.max(1, ...graph.nodes.map((node) => node.commits));
const desktopNodes = selectNodes(graph.nodes, true);
const mobileNodes = selectNodes(graph.nodes, false);

const Home: React.FC = () => {
  return (
    <main>
      <section className="hero" aria-labelledby="site-name">
        <div className="hero-overlay pointer-events-none flex flex-col justify-between gap-[calc(var(--rhythm)*2)] px-3 py-[calc(var(--rhythm)*2)] md:px-10">
          <div className="flex flex-col gap-rhythm md:flex-row md:items-start md:justify-between">
            <div className="max-w-[34ch]">
              <h1
                id="site-name"
                className="font-display text-step-6 leading-none font-bold tracking-display text-foreground"
              >
                {site.name}
              </h1>
              <p className="mt-rhythm text-step-1 text-foreground">{site.line}</p>
            </div>
            <ContactLinks className="flex flex-col gap-2 md:flex-row md:gap-6" />
          </div>
          <div>
            <a className="cta pointer-events-auto" href={site.cta.href}>
              {site.cta.label}
            </a>
          </div>
        </div>

        <div className="hero-graph">
          <RepoGraph data={graph} copy={site.graph} maxCommits={maxCommits}>
            <GraphSnapshot
              className="hidden md:block"
              id="desktop"
              squarePx={desktopNominalSquarePx}
              nodes={desktopNodes}
              edges={edgesAmong(graph, desktopNodes)}
              layout={graph.layout}
              maxCommits={maxCommits}
              ariaLabel={site.graph.ariaLabel}
            />
            <GraphSnapshot
              className="md:hidden"
              id="mobile"
              squarePx={mobileNominalSquarePx}
              nodes={mobileNodes}
              edges={edgesAmong(graph, mobileNodes)}
              layout={graph.layout}
              maxCommits={maxCommits}
              ariaLabel={site.graph.ariaLabel}
            />
          </RepoGraph>
        </div>
      </section>

      <section
        id={site.sections.work.id}
        className="min-h-[50dvh] px-3 py-[calc(var(--rhythm)*3)] md:px-10"
        aria-labelledby="work-title"
      >
        <h2
          id="work-title"
          className="font-display text-step-3 font-semibold tracking-display text-foreground"
        >
          {site.sections.work.title}
        </h2>
      </section>

      <section
        id={site.sections.about.id}
        className="px-3 py-[calc(var(--rhythm)*3)] md:px-10"
        aria-labelledby="about-title"
      >
        <h2
          id="about-title"
          className="font-display text-step-3 font-semibold tracking-display text-foreground"
        >
          {site.sections.about.title}
        </h2>
        <ContactLinks className="mt-rhythm flex flex-col gap-2 md:flex-row md:gap-6" />
      </section>
    </main>
  );
};

export default Home;

interface ContactLinksProps {
  className: string;
}

const ContactLinks: React.FC<ContactLinksProps> = ({ className }) => {
  return (
    <nav aria-label="Contact">
      <ul className={className}>
        {site.links.map((link) => {
          const external = link.href.startsWith("http");
          return (
            <li key={link.href}>
              <a
                className="hero-link pointer-events-auto"
                href={link.href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
              >
                {link.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

function loadGraph(value: unknown): GraphData {
  if (!isGraphData(value)) {
    throw new Error("content/graph.json is not a graph; run `npm run graph:data`");
  }
  return value;
}

function edgesAmong(data: GraphData, nodes: GraphNode[]): GraphData["edges"] {
  const ids = new Set(nodes.map((node) => node.id));
  return data.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
}
