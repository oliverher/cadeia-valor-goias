"use client";

import { useMemo, useState } from "react";
import database from "./process-data.json";

type Process = { name: string; group: "gerencial" | "finalistico" | "suporte" };
type HierarchyNode = {
  name: string;
  description: string;
  legal: string;
  basicUnit: string;
  complementaryUnit: string;
  source: string;
  situation: string;
  organizations: string[];
  type: "macroprocess" | "process" | "workProcess" | "service" | "activity";
  children: HierarchyNode[];
};
type Detail = {
  name: string;
  group: Process["group"];
  description: string;
  legal: string;
  organizations: string[];
  processes: { name: string; description: string; legal: string }[];
  workProcesses: { name: string; description: string; legal: string }[];
  sources: string[];
  situations: string[];
  stats: { processes: number; workProcesses: number; organizations: number; services: number; activities: number };
  hierarchy: HierarchyNode[];
};

const processes: Process[] = [
  { name: "Gestão da estratégia organizacional", group: "gerencial" },
  { name: "Gestão de controles institucionais", group: "gerencial" },
  { name: "Gestão da informação corporativa", group: "gerencial" },
  { name: "Gestão do desenvolvimento organizacional e da inovação", group: "gerencial" },
  { name: "Gestão de comunicação institucional", group: "gerencial" },
  ...[
    "Agropecuária", "Defesa da ordem jurídica", "Esporte", "Regulação Legislativa", "Transportes e trânsito",
    "Assistência Social", "Defesa do Estado", "Indústria, comércio e serviços", "Relações Governamentais", "Tributação",
    "Ciência, tecnologia e inovação", "Defesa dos direitos", "Judiciário", "Saúde", "Turismo", "Comunicações",
    "Desenvolvimento urbano", "Meio ambiente", "Segurança pública", "Cultura", "Educação", "Minas e energia", "Trabalho",
  ].map((name) => ({ name, group: "finalistico" as const })),
  ...[
    "Gestão da consultoria jurídica institucional", "Gestão da administração financeira", "Gestão de contabilidade pública",
    "Gestão de Logística Pública", "Gestão de Pessoas", "Gestão de tecnologia da informação e comunicação",
    "Gestão do patrimônio imobiliário", "Gestão do patrimônio mobiliário",
  ].map((name) => ({ name, group: "suporte" as const })),
];

const labels = { gerencial: "Macroprocesso gerencial", finalistico: "Macrofunção finalística", suporte: "Macroprocesso de suporte" };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\bda\b/g, "de").replace(/\s+/g, " ").trim();

function ProcessButton({ process, active, onSelect }: { process: Process; active: boolean; onSelect: () => void }) {
  return <button className={`process ${process.group} ${active ? "active" : ""}`} onClick={onSelect}>{process.name}</button>;
}

const nodeLabels = { macroprocess: "Macroprocesso", process: "Processo", workProcess: "Processo de trabalho", service: "Serviço", activity: "Atividade" };
type FilterType = "macrofunction" | "macroprocess" | "process" | "workProcess" | "service" | "activity";
type FilterItem = { name: string; owner: string; type: FilterType; group: Process["group"]; description: string; legal: string; basicUnit: string; complementaryUnit: string; organizations: string[]; situations: string[] };

const metricLabels: Record<FilterType, string> = {
  macrofunction: "Macrofunções", macroprocess: "Macroprocessos", process: "Processos",
  workProcess: "Processos de Trabalho", service: "Serviços", activity: "Atividades",
};

function flattenNodes(nodes: HierarchyNode[]): HierarchyNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function filterHierarchyByOrganization(nodes: HierarchyNode[], organization: string): HierarchyNode[] {
  return nodes.flatMap((node) => {
    const children = filterHierarchyByOrganization(node.children, organization);
    const belongsToOrganization = node.organizations.some((value) => normalize(value) === normalize(organization));
    return belongsToOrganization || children.length > 0 ? [{ ...node, children }] : [];
  });
}

type ExportRow = {
  "Órgão": string; "Categoria": string; "Nível": string; "Macrofunção finalística": string;
  "Macroprocesso": string; "Processo": string; "Processo de trabalho": string; "Serviço": string; "Atividade": string;
  "Descrição": string; "Situação": string; "Unidade Básica": string; "Unidade Complementar": string;
  "Referência legal": string; "Fonte": string;
};

function exportRowsForOrganization(groups: Detail[], organization: string): ExportRow[] {
  const rows: ExportRow[] = [];
  const categoryLabel = (group: Process["group"]) => group === "finalistico" ? "Finalístico" : group === "gerencial" ? "Gerencial" : "Suporte";
  for (const group of groups) {
    const hierarchy = filterHierarchyByOrganization(group.hierarchy, organization);
    const groupBelongs = group.organizations.some((value) => normalize(value) === normalize(organization));
    if (hierarchy.length === 0 && !groupBelongs) continue;
    const basePath = { macrofunction: group.group === "finalistico" ? group.name : "", macroprocess: group.group === "finalistico" ? "" : group.name, process: "", workProcess: "", service: "", activity: "" };
    rows.push({
      "Órgão": organization, "Categoria": categoryLabel(group.group), "Nível": group.group === "finalistico" ? "Macrofunção finalística" : "Macroprocesso",
      "Macrofunção finalística": basePath.macrofunction, "Macroprocesso": basePath.macroprocess, "Processo": "", "Processo de trabalho": "", "Serviço": "", "Atividade": "",
      "Descrição": group.description, "Situação": group.situations.join("; "), "Unidade Básica": "", "Unidade Complementar": "", "Referência legal": group.legal, "Fonte": group.sources.join("; "),
    });
    const visit = (nodes: HierarchyNode[], path: typeof basePath) => {
      for (const node of nodes) {
        const nextPath = { ...path, [node.type]: node.name };
        rows.push({
          "Órgão": organization, "Categoria": categoryLabel(group.group), "Nível": nodeLabels[node.type],
          "Macrofunção finalística": nextPath.macrofunction, "Macroprocesso": nextPath.macroprocess, "Processo": nextPath.process,
          "Processo de trabalho": nextPath.workProcess, "Serviço": nextPath.service, "Atividade": nextPath.activity,
          "Descrição": node.description, "Situação": node.situation, "Unidade Básica": node.basicUnit,
          "Unidade Complementar": node.complementaryUnit, "Referência legal": node.legal, "Fonte": node.source,
        });
        visit(node.children, nextPath);
      }
    };
    visit(hierarchy, basePath);
  }
  return rows;
}

const pdfSafe = (value: string) => value
  .replace(/[\u2010-\u2015]/g, "-")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

function HierarchyTree({ nodes, group, level = 1 }: { nodes: HierarchyNode[]; group: Process["group"]; level?: number }) {
  return <div className={`hierarchy level-${level}`}>
    {nodes.map((node, index) => {
      const hasChildren = node.children.length > 0;
      const content = <div className={`hierarchy-card ${group} ${node.type}`}>
        <span className="node-kind">{nodeLabels[node.type]}</span>
        <b>{node.name}</b>
        {node.organizations.length > 0 && <span className="node-organizations">Órgão: {node.organizations.join("; ")}</span>}
        {node.description && <span className="node-detail"><strong>Descrição:</strong> {node.description}</span>}
        {node.legal && <span className="node-detail"><strong>Referência legal:</strong> {node.legal}</span>}
        {(node.type === "workProcess" || node.type === "service") && node.basicUnit && <span className="node-detail"><strong>Unidade Básica:</strong> {node.basicUnit}</span>}
        {(node.type === "workProcess" || node.type === "service") && node.complementaryUnit && <span className="node-detail"><strong>Unidade Complementar:</strong> {node.complementaryUnit}</span>}
        {(node.type === "workProcess" || node.type === "service") && node.situation && <span className="node-situation">Situação: {node.situation}</span>}
        {node.type === "service" && <span className="service-badge">Carta de Serviços</span>}
      </div>;
      return hasChildren ? <details key={`${node.name}-${index}`} open={node.type === "macroprocess"}>
        <summary>{content}<span className="expand-mark" aria-hidden="true">⌄</span></summary>
        <HierarchyTree nodes={node.children} group={group} level={level + 1} />
      </details> : <div key={`${node.name}-${index}`}>{content}</div>;
    })}
  </div>;
}

type AnalyticSection = "overview" | Process["group"];
type AnalyticFilters = { thematic: string; organization: string; situation: string; search: string };

function AnalyticDashboard({ groups }: { groups: Detail[] }) {
  const [section, setSection] = useState<AnalyticSection>("overview");
  const [analyticFilters, setAnalyticFilters] = useState<AnalyticFilters>({ thematic: "all", organization: "all", situation: "all", search: "" });
  const organizations = useMemo(() => [...new Set(groups.flatMap((group) => [
    ...group.organizations, ...flattenNodes(group.hierarchy).flatMap((node) => node.organizations),
  ]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [groups]);
  const situations = useMemo(() => [...new Set(groups.flatMap((group) => [
    ...group.situations, ...flattenNodes(group.hierarchy).map((node) => node.situation),
  ]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [groups]);
  const sectionGroups = groups.filter((group) => section === "overview" || group.group === section);
  const thematicOptions = sectionGroups.map((group) => group.name).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filteredGroups = sectionGroups.filter((group) => {
    const nodes = flattenNodes(group.hierarchy);
    const haystack = normalize([group.name, group.description, ...group.organizations, ...nodes.flatMap((node) => [node.name, node.description, ...node.organizations])].join(" "));
    if (analyticFilters.thematic !== "all" && normalize(group.name) !== normalize(analyticFilters.thematic)) return false;
    if (analyticFilters.organization !== "all" && ![...group.organizations, ...nodes.flatMap((node) => node.organizations)].some((org) => normalize(org) === normalize(analyticFilters.organization))) return false;
    if (analyticFilters.situation !== "all" && ![...group.situations, ...nodes.map((node) => node.situation)].some((value) => normalize(value) === normalize(analyticFilters.situation))) return false;
    return !analyticFilters.search || haystack.includes(normalize(analyticFilters.search));
  });
  const filteredNodes = filteredGroups.flatMap((group) => flattenNodes(group.hierarchy));
  const count = (type: HierarchyNode["type"]) => filteredNodes.filter((node) => node.type === type).length;
  const totals = [
    { label: "Macroestruturas", value: filteredGroups.length, tone: "green" },
    { label: "Macroprocessos", value: count("macroprocess"), tone: "gold" },
    { label: "Processos", value: count("process"), tone: "blue" },
    { label: "Processos de trabalho", value: count("workProcess"), tone: "purple" },
    { label: "Serviços", value: count("service"), tone: "violet" },
    { label: "Atividades", value: count("activity"), tone: "gray" },
  ];
  const quantitativeGroups = (["finalistico", "gerencial", "suporte"] as Process["group"][]).map((group) => {
    const relatedGroups = filteredGroups.filter((item) => item.group === group);
    const nodes = relatedGroups.flatMap((item) => flattenNodes(item.hierarchy));
    const cards = group === "finalistico"
      ? [
          { label: "Macrofunções", value: relatedGroups.length },
          { label: "Macroprocessos", value: nodes.filter((node) => node.type === "macroprocess").length },
          { label: "Processos", value: nodes.filter((node) => node.type === "process").length },
          { label: "Processos de Trabalho", value: nodes.filter((node) => node.type === "workProcess").length },
          { label: "Serviços", value: nodes.filter((node) => node.type === "service").length },
          { label: "Atividades", value: nodes.filter((node) => node.type === "activity").length },
        ]
      : [
          { label: "Macroprocessos", value: relatedGroups.length },
          { label: "Processos", value: nodes.filter((node) => node.type === "process").length },
          { label: "Processos de Trabalho", value: nodes.filter((node) => node.type === "workProcess").length },
          { label: "Serviços", value: nodes.filter((node) => node.type === "service").length },
          { label: "Atividades", value: nodes.filter((node) => node.type === "activity").length },
        ];
    return { group, cards };
  });
  const thematicRanking = filteredGroups
    .filter((group) => group.group === "finalistico")
    .map((group) => ({ name: group.name, value: flattenNodes(group.hierarchy).filter((node) => node.type === "macroprocess").length }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
  const maxThematic = Math.max(1, ...thematicRanking.map((item) => item.value));
  const classificationSummary = ([
    { group: "finalistico", label: "Finalístico", color: "#f5c842" },
    { group: "gerencial", label: "Gerencial", color: "#08a65a" },
    { group: "suporte", label: "Suporte", color: "#0860a8" },
  ] as const).map((item) => ({ ...item, value: filteredGroups.filter((group) => group.group === item.group).length }));
  const classificationTotal = classificationSummary.reduce((sum, item) => sum + item.value, 0);
  const finalisticShare = classificationTotal ? classificationSummary[0].value / classificationTotal * 100 : 0;
  const managerialShare = classificationTotal ? classificationSummary[1].value / classificationTotal * 100 : 0;
  const donutBackground = `conic-gradient(#f5c842 0 ${finalisticShare}%, #08a65a ${finalisticShare}% ${finalisticShare + managerialShare}%, #0860a8 ${finalisticShare + managerialShare}% 100%)`;
  const macroprocessRows = filteredGroups.flatMap((group) => {
    if (group.group !== "finalistico") {
      return [{ name: group.name, group: group.group, value: flattenNodes(group.hierarchy).filter((node) => node.type === "process").length }];
    }
    return flattenNodes(group.hierarchy)
      .filter((node) => node.type === "macroprocess")
      .map((node) => ({ name: node.name, group: group.group, value: flattenNodes(node.children).filter((child) => child.type === "process").length }));
  }).filter((item) => item.value > 0).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
  const processRows = filteredGroups.flatMap((group) => flattenNodes(group.hierarchy)
    .filter((node) => node.type === "process")
    .map((node) => ({ name: node.name, group: group.group, value: flattenNodes(node.children).filter((child) => child.type === "workProcess").length })))
    .filter((item) => item.value > 0).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
  const maxMacroprocess = Math.max(1, ...macroprocessRows.map((item) => item.value));
  const maxProcess = Math.max(1, ...processRows.map((item) => item.value));
  const organizationRows = organizations.map((organization) => {
    const related = filteredGroups.filter((group) => {
      const nodes = flattenNodes(group.hierarchy);
      return [...group.organizations, ...nodes.flatMap((node) => node.organizations)].some((org) => normalize(org) === normalize(organization));
    });
    const nodes = related.flatMap((group) => flattenNodes(group.hierarchy).filter((node) => node.organizations.some((org) => normalize(org) === normalize(organization))));
    return { organization, structures: related.length, processes: nodes.filter((node) => node.type === "process").length, work: nodes.filter((node) => node.type === "workProcess").length, services: nodes.filter((node) => node.type === "service").length, activities: nodes.filter((node) => node.type === "activity").length };
  }).filter((row) => row.structures > 0).sort((a, b) => (b.processes + b.work + b.services + b.activities) - (a.processes + a.work + a.services + a.activities));
  const reset = () => setAnalyticFilters({ thematic: "all", organization: "all", situation: "all", search: "" });

  return <section className="analytics" aria-labelledby="analytics-title">
    <div className="analytics-hero"><div><p className="eyebrow">Inteligência organizacional</p><h2 id="analytics-title">Visão Analítica</h2><p>Indicadores e relações da Cadeia de Valor do Estado de Goiás, calculados em tempo real a partir da base atualizada.</p></div><div className="analytics-update"><span>Base consolidada</span><b>{database.updatedAt.split("-").reverse().join("/")}</b></div></div>
    <nav className="analytics-tabs" aria-label="Classificação da visão analítica">{([
      ["overview", "Visão Geral"], ["finalistico", "Processos Finalísticos"], ["gerencial", "Processos Gerenciais"], ["suporte", "Processos de Suporte"],
    ] as [AnalyticSection, string][]).map(([value, label]) => <button key={value} className={section === value ? "active" : ""} onClick={() => { setSection(value); setAnalyticFilters((current) => ({ ...current, thematic: "all" })); }}>{label}</button>)}</nav>
    <div className="analytics-layout">
      <aside className="analytics-filters"><div><p className="eyebrow">Refine a análise</p><h3>Filtros</h3></div>
        <label><span>Buscar</span><input value={analyticFilters.search} onChange={(event) => setAnalyticFilters({ ...analyticFilters, search: event.target.value })} placeholder="Estrutura, processo ou órgão" /></label>
        <label><span>Macroestrutura temática</span><select value={analyticFilters.thematic} onChange={(event) => setAnalyticFilters({ ...analyticFilters, thematic: event.target.value })}><option value="all">Todas</option>{thematicOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Órgão</span><select value={analyticFilters.organization} onChange={(event) => setAnalyticFilters({ ...analyticFilters, organization: event.target.value })}><option value="all">Todos</option>{organizations.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Situação</span><select value={analyticFilters.situation} onChange={(event) => setAnalyticFilters({ ...analyticFilters, situation: event.target.value })}><option value="all">Todas</option>{situations.map((value) => <option key={value}>{value}</option>)}</select></label>
        <button className="analytics-reset" onClick={reset}>Limpar todos os filtros</button><small>Todos os painéis ao lado respondem aos filtros selecionados.</small>
      </aside>
      <div className="analytics-content">
        {section === "overview" ? <section className="analytics-quantitative" aria-labelledby="analytics-quantitative-title">
          <header><div><p className="eyebrow">Visão quantitativa</p><h3 id="analytics-quantitative-title">Painel da cadeia de valor</h3></div><p>Os indicadores respondem aos filtros selecionados.</p></header>
          {quantitativeGroups.map(({ group, cards }) => <div className={`analytics-metric-group ${group}`} key={group}>
            <h4>{group === "finalistico" ? "Finalístico" : group === "gerencial" ? "Gerencial" : "Suporte"}</h4>
            <div>{cards.map((card) => <article key={card.label}><span>{card.label}</span><div><b>{card.value.toLocaleString("pt-BR")}</b><i /></div></article>)}</div>
          </div>)}
          <div className="overview-chart-grid">
            <article className="overview-chart-card thematic-chart">
              <header><div><p className="eyebrow">Finalístico</p><h4>Total de Macroprocessos por Temática</h4></div><span className="chart-key finalistic">Finalístico</span></header>
              <div className="thematic-bars">{thematicRanking.map((item) => <div key={item.name}>
                <span title={item.name}>{item.name}</span><i><b style={{ width: `${item.value / maxThematic * 100}%` }} /></i><strong>{item.value.toLocaleString("pt-BR")}</strong>
              </div>)}</div>
              {thematicRanking.length === 0 && <p className="analytics-empty">Nenhuma temática finalística corresponde aos filtros.</p>}
            </article>
            <article className="overview-chart-card classification-chart">
              <header><div><p className="eyebrow">Consolidado</p><h4>Macrofunções e Macroprocessos por Classificação</h4></div></header>
              <div className="donut-layout">
                <div className="donut-chart" style={{ background: donutBackground }}><div><b>{classificationTotal}</b><span>estruturas</span></div></div>
                <div className="donut-legend">{classificationSummary.map((item) => {
                  const percent = classificationTotal ? item.value / classificationTotal * 100 : 0;
                  return <div key={item.group}><i style={{ background: item.color }} /><span>{item.label}</span><b>{item.value}</b><small>{percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</small></div>;
                })}</div>
              </div>
            </article>
          </div>
        </section> : <div className="analytics-kpis">{totals.map((item) => <article className={item.tone} key={item.label}><span>{item.label}</span><b>{item.value.toLocaleString("pt-BR")}</b></article>)}</div>}
        <section className="hierarchy-chart-grid" aria-label="Indicadores da hierarquia de processos">
          {([
            { title: "Total de Processos por Macroprocesso", rows: macroprocessRows, max: maxMacroprocess, empty: "Nenhum macroprocesso com processos corresponde aos filtros." },
            { title: "Total de Processos de Trabalho por Processo", rows: processRows, max: maxProcess, empty: "Nenhum processo com processos de trabalho corresponde aos filtros." },
          ] as const).map((chart) => <article className="hierarchy-chart-card" key={chart.title}>
            <header><h3>{chart.title}</h3><div className="hierarchy-chart-legend"><span className="finalistico">Finalístico</span><span className="gerencial">Gerencial</span><span className="suporte">Suporte</span></div></header>
            <div className="hierarchy-chart-bars">{chart.rows.map((item, index) => <div key={`${item.group}-${item.name}-${index}`}>
              <span title={item.name}>{item.name}</span><i><b className={item.group} style={{ width: `${item.value / chart.max * 100}%` }}><strong>{item.value.toLocaleString("pt-BR")}</strong></b></i>
            </div>)}</div>
            {chart.rows.length === 0 && <p className="analytics-empty">{chart.empty}</p>}
          </article>)}
        </section>
        <article className="analytic-card organization-table"><header><div><p className="eyebrow">Visão institucional</p><h3>Participação dos órgãos na cadeia</h3></div><span>{organizationRows.length} órgãos</span></header><div className="table-scroll"><table><thead><tr><th>Órgão</th><th>Estruturas</th><th>Processos</th><th>Proc. de trabalho</th><th>Serviços</th><th>Atividades</th></tr></thead><tbody>{organizationRows.map((row) => <tr key={row.organization}><th>{row.organization}</th><td>{row.structures}</td><td>{row.processes}</td><td>{row.work}</td><td>{row.services}</td><td>{row.activities}</td></tr>)}</tbody></table></div></article>
      </div>
    </div>
  </section>;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Process | null>(null);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [exportStatus, setExportStatus] = useState<"idle" | "working" | "error">("idle");
  const [pdfExportStatus, setPdfExportStatus] = useState<"idle" | "working" | "error">("idle");
  const [metricFilter, setMetricFilter] = useState<{ group: Process["group"]; type: FilterType } | null>(null);
  const [activeView, setActiveView] = useState<"chain" | "analytics">("chain");
  const [filters, setFilters] = useState<{ search: string; type: "all" | Process["group"]; level: "all" | FilterType; situation: string; organization: string }>({ search: "", type: "all", level: "all", situation: "all", organization: "all" });
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return q ? processes.filter((item) => item.name.toLocaleLowerCase("pt-BR").includes(q)) : processes;
  }, [query]);
  const grouped = (group: Process["group"]) => visible.filter((item) => item.group === group);
  const selectedDetail = selected
    ? (database.groups as Detail[]).find((item) => normalize(item.name) === normalize(selected.name)) ?? null
    : null;
  const detailGroups = database.groups as Detail[];
  const totalRecords = detailGroups.reduce((sum, item) => sum + item.stats.processes + item.stats.workProcesses + item.stats.services + item.stats.activities, 0);

  const allOrganizations = useMemo(() => [...new Set(detailGroups.flatMap((item) => item.organizations))].sort((a, b) => a.localeCompare(b, "pt-BR")), [detailGroups]);
  const allSituations = useMemo(() => [...new Set(detailGroups.flatMap((item) => item.situations).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [detailGroups]);
  const organizationDetails = filters.organization === "all" ? [] : detailGroups.flatMap((item) => {
    if (filters.type !== "all" && item.group !== filters.type) return [];
    const hierarchy = filterHierarchyByOrganization(item.hierarchy, filters.organization);
    const groupBelongs = item.organizations.some((value) => normalize(value) === normalize(filters.organization));
    return hierarchy.length > 0 || groupBelongs ? [{ ...item, hierarchy }] : [];
  });

  const getMetricItems = (group: Process["group"], type: FilterType): FilterItem[] => {
    const groups = detailGroups.filter((item) => item.group === group);
    const topItems = groups.map((item) => ({ name: item.name, owner: item.name, type, group, description: item.description, legal: item.legal, basicUnit: "", complementaryUnit: "", organizations: item.organizations, situations: item.situations }));
    let items = type === "macrofunction" || (type === "macroprocess" && group !== "finalistico") ? topItems : groups.flatMap((item) => flattenNodes(item.hierarchy)
      .filter((node) => node.type === type)
      .map((node) => ({ name: node.name, owner: item.name, type, group, description: node.description, legal: node.legal, basicUnit: node.basicUnit, complementaryUnit: node.complementaryUnit, organizations: node.organizations ?? [], situations: node.situation ? [node.situation] : [] })));
    const search = normalize(filters.search);
    items = items.filter((item) => {
      if (filters.type !== "all" && item.group !== filters.type) return false;
      if (filters.level !== "all" && item.type !== filters.level) return false;
      if (filters.situation !== "all" && !item.situations.some((value) => normalize(value) === normalize(filters.situation))) return false;
      if (filters.organization !== "all" && !item.organizations.some((value) => normalize(value) === normalize(filters.organization))) return false;
      if (search && !normalize([item.name, item.owner, item.description, ...item.organizations].join(" ")).includes(search)) return false;
      return true;
    });
    return items;
  };
  const filteredMetricItems = metricFilter ? getMetricItems(metricFilter.group, metricFilter.type) : [];
  const selectMetric = (group: Process["group"], type: FilterType) => {
    setMetricFilter({ group, type });
    window.setTimeout(() => document.getElementById("metric-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const clearFiltersAndCollapse = () => {
    setFilters({ search: "", type: "all", level: "all", situation: "all", organization: "all" });
    setMetricFilter(null);
  };
  const closeDetail = () => {
    setSelected(null);
    setDetailExpanded(false);
  };
  const exportOrganization = async () => {
    if (filters.organization === "all") return;
    const rows = exportRowsForOrganization(detailGroups, filters.organization);
    if (rows.length === 0) return;
    setExportStatus("working");
    try {
      const XLSXModule = await import("xlsx");
      const XLSX = (XLSXModule.default ?? XLSXModule) as typeof import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!autofilter"] = { ref: worksheet["!ref"] ?? "A1:O1" };
      worksheet["!cols"] = [
        { wch: 18 }, { wch: 13 }, { wch: 22 }, { wch: 34 }, { wch: 38 }, { wch: 42 }, { wch: 46 }, { wch: 42 }, { wch: 42 },
        { wch: 55 }, { wch: 18 }, { wch: 38 }, { wch: 38 }, { wch: 42 }, { wch: 24 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Cadeia de Valor");
      const safeOrganization = filters.organization.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
      const filename = `cadeia-de-valor-${safeOrganization}-${database.updatedAt}.xlsx`;
      const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setExportStatus("idle");
    } catch (error) {
      console.error("Falha ao exportar a cadeia de valor", error);
      setExportStatus("error");
    }
  };
  const exportOrganizationPdf = async () => {
    if (filters.organization === "all") return;
    const organization = filters.organization;
    const relatedGroups = detailGroups.flatMap((item) => {
      const hierarchy = filterHierarchyByOrganization(item.hierarchy, organization);
      const groupBelongs = item.organizations.some((value) => normalize(value) === normalize(organization));
      return hierarchy.length > 0 || groupBelongs ? [{ ...item, hierarchy }] : [];
    });
    if (relatedGroups.length === 0) return;
    setPdfExportStatus("working");
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      pdf.setTitle(`Cadeia de Valor - ${organization}`);
      pdf.setSubject("Cadeia de Valor Integrada do Governo de Goiás");
      pdf.setAuthor("Governo do Estado de Goiás");
      const regular = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 42;
      const contentWidth = pageWidth - margin * 2;
      const green = rgb(0.02, 0.43, 0.23);
      const darkGreen = rgb(0.03, 0.23, 0.14);
      const softGreen = rgb(0.93, 0.97, 0.94);
      const gold = rgb(0.94, 0.69, 0.08);
      const blue = rgb(0.03, 0.34, 0.62);
      const purple = rgb(0.44, 0.19, 0.63);
      const gray = rgb(0.35, 0.43, 0.39);
      const lightLine = rgb(0.86, 0.90, 0.87);
      let page = pdf.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;
      let pageNumber = 1;

      const wrap = (text: string, font: typeof regular, size: number, width: number) => {
        const words = pdfSafe(text).split(" ").filter(Boolean);
        const lines: string[] = [];
        let line = "";
        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;
          if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate;
          else { lines.push(line); line = word; }
        }
        if (line) lines.push(line);
        return lines.length > 0 ? lines : [""];
      };
      const footer = () => {
        page.drawLine({ start: { x: margin, y: 28 }, end: { x: pageWidth - margin, y: 28 }, thickness: 0.6, color: lightLine });
        page.drawText(pdfSafe(`Cadeia de Valor Integrada - ${organization}`), { x: margin, y: 14, size: 7, font: regular, color: gray });
        page.drawText(`${pageNumber}`, { x: pageWidth - margin - 10, y: 14, size: 7, font: bold, color: green });
      };
      const addPage = () => {
        footer();
        page = pdf.addPage([pageWidth, pageHeight]);
        pageNumber += 1;
        y = pageHeight - margin;
        page.drawText("CADEIA DE VALOR INTEGRADA", { x: margin, y, size: 8, font: bold, color: green });
        page.drawText(pdfSafe(organization), { x: pageWidth - margin - Math.min(180, bold.widthOfTextAtSize(pdfSafe(organization), 8)), y, size: 8, font: bold, color: darkGreen });
        y -= 22;
      };
      const ensureSpace = (height: number) => { if (y - height < 42) addPage(); };
      const drawWrapped = (text: string, x: number, width: number, size = 8.5, font = regular, color = gray, lineHeight = size * 1.35) => {
        const lines = wrap(text, font, size, width);
        ensureSpace(lines.length * lineHeight + 4);
        for (const line of lines) { page.drawText(line, { x, y, size, font, color }); y -= lineHeight; }
        return lines.length;
      };
      const nodeColor = (type: HierarchyNode["type"] | "macrofunction") => type === "macrofunction" || type === "macroprocess" ? gold : type === "service" ? purple : type === "activity" ? gray : green;
      const drawRecord = (label: string, name: string, level: number, color: ReturnType<typeof rgb>, details: Array<[string, string]>) => {
        const indent = Math.min(level, 5) * 14;
        const x = margin + indent;
        const width = contentWidth - indent;
        const titleLines = wrap(name, bold, 10, width - 22);
        const detailLines = details.filter(([, value]) => Boolean(value)).reduce((sum, [key, value]) => sum + wrap(`${key}: ${value}`, regular, 7.6, width - 22).length, 0);
        const estimated = 18 + titleLines.length * 13 + detailLines * 10 + 10;
        ensureSpace(estimated);
        page.drawLine({ start: { x, y: y + 2 }, end: { x, y: Math.max(44, y - estimated + 8) }, thickness: 3, color });
        page.drawText(pdfSafe(label).toUpperCase(), { x: x + 10, y, size: 6.5, font: bold, color });
        y -= 12;
        for (const line of titleLines) { page.drawText(line, { x: x + 10, y, size: 10, font: bold, color: darkGreen }); y -= 13; }
        for (const [key, value] of details) {
          if (!value) continue;
          drawWrapped(`${key}: ${value}`, x + 10, width - 20, 7.6, regular, gray, 10);
        }
        y -= 9;
      };

      page.drawRectangle({ x: 0, y: pageHeight - 235, width: pageWidth, height: 235, color: darkGreen });
      page.drawText("GOVERNO DE GOIÁS", { x: margin, y: pageHeight - 62, size: 9, font: bold, color: rgb(0.65, 0.86, 0.73) });
      page.drawText("Cadeia de Valor", { x: margin, y: pageHeight - 108, size: 30, font: bold, color: rgb(1, 1, 1) });
      page.drawText("do órgão", { x: margin, y: pageHeight - 137, size: 20, font: regular, color: rgb(0.82, 0.91, 0.85) });
      const orgLines = wrap(organization, bold, 24, contentWidth);
      let orgY = pageHeight - 178;
      for (const line of orgLines) { page.drawText(line, { x: margin, y: orgY, size: 24, font: bold, color: rgb(1, 1, 1) }); orgY -= 28; }
      y = pageHeight - 285;
      const flatNodes = relatedGroups.flatMap((group) => flattenNodes(group.hierarchy));
      const counts = {
        estruturas: relatedGroups.length,
        processos: flatNodes.filter((node) => node.type === "process").length,
        trabalho: flatNodes.filter((node) => node.type === "workProcess").length,
        servicos: flatNodes.filter((node) => node.type === "service").length,
        atividades: flatNodes.filter((node) => node.type === "activity").length,
      };
      const cards = [["Estruturas", counts.estruturas], ["Processos", counts.processos], ["Proc. de trabalho", counts.trabalho], ["Serviços", counts.servicos], ["Atividades", counts.atividades]] as const;
      cards.forEach(([label, value], index) => {
        const cardWidth = (contentWidth - 28) / 5;
        const x = margin + index * (cardWidth + 7);
        page.drawRectangle({ x, y: y - 58, width: cardWidth, height: 58, color: softGreen, borderColor: lightLine, borderWidth: 0.5 });
        page.drawText(String(value), { x: x + 9, y: y - 25, size: 17, font: bold, color: green });
        page.drawText(pdfSafe(label), { x: x + 9, y: y - 43, size: 6.5, font: bold, color: gray });
      });
      y -= 98;
      page.drawText("COMO LER ESTE RELATÓRIO", { x: margin, y, size: 8, font: bold, color: green });
      y -= 20;
      drawWrapped("A hierarquia é apresentada do nível mais amplo ao mais detalhado. O recuo e a linha colorida mostram a relação entre macrofunções, macroprocessos, processos, processos de trabalho, serviços e atividades.", margin, contentWidth, 10, regular, gray, 15);
      y -= 18;
      page.drawRectangle({ x: margin, y: y - 54, width: contentWidth, height: 54, color: rgb(0.98, 0.96, 0.87) });
      drawWrapped(`Base consolidada em ${database.updatedAt.split("-").reverse().join("/")}. O relatório inclui descrições, situações, unidades, referências legais e fontes disponíveis para o órgão selecionado.`, margin + 14, contentWidth - 28, 8.5, regular, darkGreen, 12);
      y -= 30;

      for (const group of relatedGroups) {
        addPage();
        const groupType = group.group === "finalistico" ? "Macrofunção finalística" : "Macroprocesso";
        const groupColor = group.group === "finalistico" ? gold : group.group === "gerencial" ? green : blue;
        drawRecord(groupType, group.name, 0, groupColor, [
          ["Categoria", group.group === "finalistico" ? "Finalístico" : group.group === "gerencial" ? "Gerencial" : "Suporte"],
          ["Descrição", group.description], ["Situação", group.situations.join("; ")],
          ["Referência legal", group.legal], ["Fonte", group.sources.join("; ")],
        ]);
        const visit = (nodes: HierarchyNode[], level: number) => {
          for (const node of nodes) {
            drawRecord(nodeLabels[node.type], node.name, level, nodeColor(node.type), [
              ["Descrição", node.description], ["Situação", node.situation], ["Unidade Básica", node.basicUnit],
              ["Unidade Complementar", node.complementaryUnit], ["Referência legal", node.legal], ["Fonte", node.source],
            ]);
            visit(node.children, level + 1);
          }
        };
        visit(group.hierarchy, 1);
      }
      footer();
      const bytes = await pdf.save();
      const safeOrganization = organization.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `cadeia-de-valor-${safeOrganization}-${database.updatedAt}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setPdfExportStatus("idle");
    } catch (error) {
      console.error("Falha ao exportar a cadeia de valor em PDF", error);
      setPdfExportStatus("error");
    }
  };

  return (
    <main>
      <header className="topbar">
        <div className="brand-mark"><img src="/logo-goias-transparent-cropped.png" alt="Governo do Estado de Goiás" /></div>
        <div><p className="eyebrow">Governo de Goiás</p><h1>Cadeia de Valor Integrada</h1><p className="subtitle">Explore os macroprocessos que conectam a gestão pública à entrega de valor para a sociedade.</p></div>
        <label className="search"><span>Buscar</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Digite um macroprocesso" /></label>
      </header>

      <nav className="view-switcher" aria-label="Áreas do portal">
        <button className={activeView === "chain" ? "active" : ""} onClick={() => setActiveView("chain")}><span>01</span>Cadeia de Valor</button>
        <button className={activeView === "analytics" ? "active" : ""} onClick={() => setActiveView("analytics")}><span>02</span>Visão Analítica</button>
      </nav>

      {activeView === "analytics" && <AnalyticDashboard groups={detailGroups} />}
      <div className={activeView === "chain" ? "chain-view" : "chain-view hidden"}>

      <div className="data-summary" aria-label="Resumo da base de dados">
        <span><b>{database.groups.filter((item) => item.group === "finalistico").length}</b> macrofunções</span>
        <span><b>{database.groups.filter((item) => item.group !== "finalistico").length}</b> macroprocessos gerenciais e de suporte</span>
        <span><b>{totalRecords.toLocaleString("pt-BR")}</b> processos e processos de trabalho</span>
        <a href="https://docs.google.com/spreadsheets/d/1dlzRPspBVdX_dblLRjzFQENg4Rg7tTr0/edit?gid=183304694#gid=183304694" target="_blank" rel="noreferrer">Consultar planilha-base ↗</a>
      </div>

      <section className="dashboard" aria-label="Cadeia de valor">
        <div className="panel managerial">
          <div className="panel-title"><span>01</span><div><small>Direcionar</small><h2>Macroprocessos gerenciais</h2></div></div>
          <div className="manager-grid">{grouped("gerencial").map((p) => <ProcessButton key={p.name} process={p} active={selected?.name === p.name} onSelect={() => setSelected(p)} />)}</div>
        </div>

        <div className="panel finalistic">
          <div className="panel-title"><span>02</span><div><small>Entregar</small><h2>Macrofunções finalísticas</h2></div></div>
          <div className="final-grid">{grouped("finalistico").map((p) => <ProcessButton key={p.name} process={p} active={selected?.name === p.name} onSelect={() => setSelected(p)} />)}</div>
        </div>

        <button className="public-value" onClick={() => setSelected(null)} aria-label="Valor público para a sociedade">
          <small>Resultado</small><strong>Valor público</strong><span className="value-icon">∞</span><b>Sociedade</b>
        </button>

        <div className="panel support">
          <div className="panel-title"><span>03</span><div><small>Viabilizar</small><h2>Macroprocessos de suporte</h2></div></div>
          <div className="support-grid">{grouped("suporte").map((p) => <ProcessButton key={p.name} process={p} active={selected?.name === p.name} onSelect={() => setSelected(p)} />)}</div>
        </div>
      </section>

      <section className="filter-panel" aria-labelledby="filter-title">
        <div className="filter-title-row"><h2 id="filter-title">Filtros</h2><div className="filter-actions"><button className="export-button" onClick={exportOrganization} disabled={filters.organization === "all" || exportStatus === "working"} title={filters.organization === "all" ? "Selecione um órgão para exportar" : `Exportar a cadeia de valor de ${filters.organization}`}>{exportStatus === "working" ? "Gerando planilha..." : "Exportar XLSX"}</button><button className="export-button pdf-button" onClick={exportOrganizationPdf} disabled={filters.organization === "all" || pdfExportStatus === "working"} title={filters.organization === "all" ? "Selecione um órgão para exportar" : `Exportar relatório visual de ${filters.organization}`}>{pdfExportStatus === "working" ? "Gerando PDF..." : "Exportar PDF"}</button>{(exportStatus === "error" || pdfExportStatus === "error") && <span className="export-error" role="alert">Não foi possível gerar o arquivo. Tente novamente.</span>}{Object.values(filters).some((value) => value !== "" && value !== "all") && <button onClick={clearFiltersAndCollapse}>Limpar filtros</button>}</div></div>
        <div className="filter-grid">
          <label><span>Buscar</span><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Processo, órgão, descrição..." /></label>
          <label><span>Tipo</span><select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value as typeof filters.type })}><option value="all">Todos</option><option value="finalistico">Finalístico</option><option value="gerencial">Gerencial</option><option value="suporte">Suporte</option></select></label>
          <label><span>Nível</span><select value={filters.level} onChange={(event) => setFilters({ ...filters, level: event.target.value as typeof filters.level })}><option value="all">Todos</option>{Object.entries(metricLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Situação</span><select value={filters.situation} onChange={(event) => setFilters({ ...filters, situation: event.target.value })}><option value="all">Todas</option>{allSituations.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Órgão</span><select value={filters.organization} onChange={(event) => setFilters({ ...filters, organization: event.target.value })}><option value="all">Todos</option>{allOrganizations.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
      </section>

      {filters.organization !== "all" && <section className="organization-results" aria-labelledby="organization-results-title">
        <div className="organization-results-heading"><div><p className="eyebrow">Visão por órgão</p><h2 id="organization-results-title">{filters.organization}</h2></div><b>{organizationDetails.length} estruturas relacionadas</b></div>
        {organizationDetails.length > 0 ? organizationDetails.map((item) => {
          const relatedNodes = flattenNodes(item.hierarchy);
          return <article className={`organization-group ${item.group}`} key={`${item.group}-${item.name}`}>
            <header><div><span>{item.group === "finalistico" ? "Macrofunção" : "Macroprocesso"}</span><h3>{item.name}</h3><small>Órgãos vinculados: {item.organizations.join("; ")}</small></div><b>{relatedNodes.length} registros na hierarquia</b></header>
            {item.hierarchy.length > 0 ? <HierarchyTree nodes={item.hierarchy} group={item.group} /> : <p className="organization-empty">O órgão está associado a esta estrutura, mas não há processos detalhados cadastrados para ele.</p>}
          </article>;
        }) : <p className="organization-empty">Nenhuma estrutura foi encontrada para este órgão com os demais filtros selecionados.</p>}
      </section>}

      <section className="metrics-panel" aria-labelledby="metrics-title">
        <div className="metrics-heading"><div className="metrics-heading-main"><div><p className="eyebrow">Visão quantitativa</p><h2 id="metrics-title">Painel da cadeia de valor</h2></div><button className="clear-collapse" onClick={clearFiltersAndCollapse}>Limpar filtro e recolher</button></div><p>Clique em um cartão para listar os registros correspondentes.</p></div>
        {(["finalistico", "gerencial", "suporte"] as Process["group"][]).filter((group) => filters.type === "all" || filters.type === group).map((group) => {
          const types: FilterType[] = group === "finalistico"
            ? ["macrofunction", "macroprocess", "process", "workProcess", "service", "activity"]
            : ["macroprocess", "process", "workProcess", "service", "activity"];
          return <div className={`metric-group ${group}`} key={group}>
            <h3>{group === "finalistico" ? "Finalístico" : group === "gerencial" ? "Gerencial" : "Suporte"}</h3>
            <div className="metric-grid">{types.filter((type) => filters.level === "all" || filters.level === type).map((type) => {
              const count = getMetricItems(group, type).length;
              const active = metricFilter?.group === group && metricFilter.type === type;
              return <button key={type} className={`metric-card ${active ? "active" : ""}`} onClick={() => selectMetric(group, type)} aria-pressed={active}>
                <span>{metricLabels[type]}</span><div><b>{count.toLocaleString("pt-BR")}</b><i /></div>
              </button>;
            })}</div>
          </div>;
        })}
      </section>

      {metricFilter && <section id="metric-results" className={`metric-results ${metricFilter.group}`}>
        <div className="results-header"><div><p className="eyebrow">Filtro selecionado</p><h2>{metricLabels[metricFilter.type]} — {metricFilter.group === "finalistico" ? "Finalístico" : metricFilter.group === "gerencial" ? "Gerencial" : "Suporte"}</h2></div><b>{filteredMetricItems.length.toLocaleString("pt-BR")} registros</b></div>
        <div className="results-list">{filteredMetricItems.map((item, index) => <article key={`${item.owner}-${item.name}-${index}`}><span>{item.owner}</span><h3>{item.name}</h3><small>Órgão: {item.organizations.length > 0 ? item.organizations.join("; ") : "Não informado na planilha"}</small>{item.description && <p><strong>Descrição:</strong> {item.description}</p>}{item.legal && <p><strong>Referência legal:</strong> {item.legal}</p>}{(item.type === "workProcess" || item.type === "service") && item.basicUnit && <p><strong>Unidade Básica:</strong> {item.basicUnit}</p>}{(item.type === "workProcess" || item.type === "service") && item.complementaryUnit && <p><strong>Unidade Complementar:</strong> {item.complementaryUnit}</p>}{(item.type === "workProcess" || item.type === "service") && item.situations.length > 0 && <em>Situação: {item.situations.join("; ")}</em>}{item.type === "service" && <b>Serviço • Carta de Serviços</b>}</article>)}</div>
      </section>}

      {query && visible.length === 0 && <p className="empty">Nenhum macroprocesso encontrado para “{query}”.</p>}
      </div>

      <aside className={`detail ${selected ? `open ${selected.group}` : ""} ${detailExpanded ? "expanded" : ""}`} aria-live="polite">
        {selected && <>
          <button className="detail-expand" onClick={() => setDetailExpanded((value) => !value)} aria-label={detailExpanded ? "Recolher painel de detalhes" : "Expandir painel de detalhes"} aria-pressed={detailExpanded} title={detailExpanded ? "Recolher painel" : "Expandir painel"}>{detailExpanded ? "›" : "‹"}</button>
          <button className="close" onClick={closeDetail} aria-label="Fechar detalhes">×</button>
          <p className="detail-label">{labels[selected.group]}</p>
          <h3>{selected.name}</h3>
          {selectedDetail ? <>
            <div className="detail-stats">
              <div><b>{selectedDetail.stats.processes}</b><span>Processos</span></div>
              <div><b>{selectedDetail.stats.workProcesses}</b><span>Processos de trabalho</span></div>
              <div><b>{selectedDetail.stats.organizations}</b><span>Órgãos</span></div>
            </div>
            <div className="hierarchy-legend" aria-label="Legenda dos níveis">
              {selected.group === "finalistico" && <span className="legend-level l0">Macrofunção</span>}
              <span className="legend-level l1">Macroprocesso</span><span className="legend-level l2">Processo</span><span className="legend-level l3">Processo de trabalho</span><span className="legend-service">Serviço</span><span className="legend-activity">Atividade</span>
            </div>
            {selectedDetail.description && <section className="detail-section"><h4>Descrição</h4><p>{selectedDetail.description}</p></section>}
            {selectedDetail.organizations.length > 0 && <section className="detail-section"><h4>Órgãos responsáveis</h4><div className="tags">{selectedDetail.organizations.map((org) => <span key={org}>{org}</span>)}</div></section>}
            {selectedDetail.hierarchy.length > 0 && <section className="detail-section hierarchy-section"><h4>Estrutura completa</h4><p className="hierarchy-help">Use as setas para abrir os processos e visualizar seus processos de trabalho e serviços.</p><HierarchyTree nodes={selectedDetail.hierarchy} group={selected.group} /></section>}
            {selectedDetail.legal && <section className="detail-section"><h4>Referência legal</h4><p>{selectedDetail.legal}</p></section>}
            <p className="data-note">Dados consolidados da planilha-base em 10/07/2026.</p>
          </> : <div className="placeholder"><span>Base de dados</span><b>Não foram encontrados registros detalhados para este item.</b></div>}
        </>}
      </aside>
      {selected && <button className="backdrop" onClick={closeDetail} aria-label="Fechar detalhes" />}
    </main>
  );
}
