import XLSX from "xlsx";
import { writeFileSync } from "node:fs";

const workbook = XLSX.readFile("data/cadeia-valor.xlsx");

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const unique = (items) => [...new Set(items.map(clean).filter(Boolean))];
const canonicalOrg = (value) => {
  const text = clean(value).replace(/\?/g, "").replace(/\s*\(.*$/, "").trim();
  const compoundAcronym = text.match(/^([A-ZÁÉÍÓÚÇ]{2,})\s*-/);
  return compoundAcronym ? compoundAcronym[1] : text;
};
const splitOrgs = (value) => unique(clean(value).split(/[;,\/|]+/).map(canonicalOrg).filter(Boolean));

function readSheet(sheetName, kind) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" }).slice(2);
  let currentTop = null;
  let currentMacroprocess = null;
  let currentProcess = null;
  const groups = [];

  for (const row of rows) {
    const name = clean(row[0]);
    const classification = clean(row[1]);
    const architecture = clean(row[2]);
    if (!name || name.startsWith("#") || !classification || !architecture) continue;

    const isTop = kind === "finalistico" ? architecture === "Macrofunção" : architecture === "Macroprocesso";
    if (isTop) {
      currentTop = {
        name,
        group: kind === "finalistico" ? "finalistico" : classification.toLowerCase().startsWith("gerenc") ? "gerencial" : "suporte",
        description: clean(row[kind === "finalistico" ? 5 : 6]),
        legal: clean(row[kind === "finalistico" ? 6 : 7]),
        organizations: splitOrgs(row[kind === "finalistico" ? 4 : 4]),
        processes: [],
        workProcesses: [],
        services: [],
        activities: [],
        sources: [],
        situations: [],
        hierarchy: [],
      };
      groups.push(currentTop);
      currentMacroprocess = null;
      currentProcess = null;
    }
    if (!currentTop) continue;

    const source = clean(row[3]);
    const orgs = splitOrgs(row[4]);
    const description = clean(row[kind === "finalistico" ? 5 : 6]);
    const legal = clean(row[kind === "finalistico" ? 6 : 7]);
    const basicUnit = clean(row[kind === "finalistico" ? 7 : 8]);
    const complementaryUnit = clean(row[kind === "finalistico" ? 8 : 9]);
    const situation = clean(row[kind === "finalistico" ? 13 : 14]);
    currentTop.organizations.push(...orgs);
    if (source) currentTop.sources.push(source);
    if (situation) currentTop.situations.push(situation);

    const item = { name, description, legal, basicUnit, complementaryUnit, organizations: orgs, source, situation, type: "process", children: [] };
    if (kind === "finalistico" && architecture === "Macroprocesso") {
      item.type = "macroprocess";
      currentTop.hierarchy.push(item);
      currentMacroprocess = item;
      currentProcess = null;
    }
    if (architecture === "Processo") {
      item.type = "process";
      currentTop.processes.push(item);
      (currentMacroprocess?.children ?? currentTop.hierarchy).push(item);
      currentProcess = item;
    }
    if (architecture === "Processo de Trabalho") {
      item.type = source.toLocaleLowerCase("pt-BR").includes("carta de servi") ? "service" : "workProcess";
      if (item.type === "service") currentTop.services.push(item);
      else currentTop.workProcesses.push(item);
      (currentProcess?.children ?? currentMacroprocess?.children ?? currentTop.hierarchy).push(item);
    }
    if (architecture === "Atividade") {
      item.type = "activity";
      currentTop.activities.push(item);
      (currentProcess?.children ?? currentMacroprocess?.children ?? currentTop.hierarchy).push(item);
    }
  }
  return groups;
}

function rollUpOrganizations(node) {
  const children = node.children.map(rollUpOrganizations);
  return {
    ...node,
    children,
    organizations: unique([...node.organizations, ...children.flatMap((child) => child.organizations)]),
  };
}

const groups = [
  ...readSheet("3. Processos Finalísticos", "finalistico"),
  ...readSheet("4. Processos Gerenciais e de Su", "support"),
].map((group) => ({
  ...group,
  hierarchy: group.hierarchy.map(rollUpOrganizations),
  organizations: unique(group.organizations),
  sources: unique(group.sources),
  situations: unique(group.situations),
  stats: {
    processes: group.processes.length,
    workProcesses: group.workProcesses.length,
    organizations: unique(group.organizations).length,
    services: group.services.length,
    activities: group.activities.length,
  },
}));

const updatedAt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

writeFileSync("app/process-data.json", JSON.stringify({ updatedAt, groups }, null, 2));
console.log(`Gerados ${groups.length} grupos com ${groups.reduce((sum, group) => sum + group.processes.length + group.workProcesses.length, 0)} registros.`);
