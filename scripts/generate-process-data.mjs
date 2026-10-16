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

const PDCA_PREFIX = /^[PDCA]\s*:/;
const firstUrl = (value) => clean(value).match(/https?:\/\/[^\s;,]+/)?.[0] ?? "";
const warnings = [];

// Normaliza a coluna "Arquitetura": aceita variações de caixa/espaços e trata
// "Processo esfera federal" como Processo (com marcação de esfera federal).
function normalizeArchitecture(value) {
  const text = clean(value).toLocaleLowerCase("pt-BR");
  if (text === "macrofunção" || text === "macrofuncao") return { level: "Macrofunção" };
  if (text === "macroprocesso") return { level: "Macroprocesso" };
  if (text === "processo") return { level: "Processo" };
  if (text === "processo esfera federal") return { level: "Processo", federal: true };
  if (text === "processo de trabalho") return { level: "Processo de Trabalho" };
  if (text === "atividade") return { level: "Atividade" };
  return null;
}

// Na planilha, todo Processo segue o ciclo PDCA e começa com "P:", "D:", "C:" ou "A:".
// Quando logo abaixo de um Processo com prefixo aparece uma sequência de linhas
// marcadas como "Processo", sem prefixo e sem filhos, elas são desdobramentos
// daquele Processo e são exibidas como Processos de Trabalho.
function detectMisclassifiedProcesses(rows, sheetName) {
  const demoted = new Set();
  const entries = rows
    .map((row, index) => ({ index, name: clean(row[0]), arch: normalizeArchitecture(row[2]) }))
    .filter((entry) => entry.name && !entry.name.startsWith("#") && entry.arch);
  for (let i = 0; i < entries.length; i += 1) {
    const parent = entries[i];
    if (parent.arch.level !== "Processo" || !PDCA_PREFIX.test(parent.name)) continue;
    let j = i + 1;
    const run = [];
    while (j < entries.length && entries[j].arch.level === "Processo" && !PDCA_PREFIX.test(entries[j].name)) {
      run.push(entries[j]);
      j += 1;
    }
    const next = entries[j];
    const runHasChildren = next && (next.arch.level === "Processo de Trabalho" || next.arch.level === "Atividade");
    if (run.length > 0 && !runHasChildren) {
      for (const entry of run) {
        demoted.add(entry.index);
        warnings.push(`[${sheetName}] linha ${entry.index + 3}: "${entry.name}" está como Processo sem prefixo PDCA, abaixo de "${parent.name}". Exibido como Processo de Trabalho.`);
      }
    }
  }
  return demoted;
}

function readSheet(sheetName, kind) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" }).slice(2);
  const demoted = detectMisclassifiedProcesses(rows, sheetName);
  const col = kind === "finalistico"
    ? { description: 5, legal: 6, basicUnit: 7, complementaryUnit: 8, link: 12, situation: 13 }
    : { description: 6, legal: 7, basicUnit: 8, complementaryUnit: 9, link: 13, situation: 14 };
  let currentTop = null;
  let currentMacroprocess = null;
  let currentProcess = null;
  let currentWorkProcess = null;
  const groups = [];

  rows.forEach((row, rowIndex) => {
    const name = clean(row[0]);
    const classification = clean(row[1]);
    const arch = normalizeArchitecture(row[2]);
    if (!name || name.startsWith("#")) return;
    if (!arch) {
      if (clean(row[2])) warnings.push(`[${sheetName}] linha ${rowIndex + 3}: arquitetura "${clean(row[2])}" não reconhecida em "${name}". Linha ignorada.`);
      return;
    }
    if (!classification) warnings.push(`[${sheetName}] linha ${rowIndex + 3}: "${name}" está sem classificação (coluna 2).`);
    const architecture = demoted.has(rowIndex) ? "Processo de Trabalho" : arch.level;

    const isTop = kind === "finalistico" ? architecture === "Macrofunção" : architecture === "Macroprocesso";
    if (isTop) {
      currentTop = {
        name,
        group: kind === "finalistico" ? "finalistico" : classification.toLowerCase().startsWith("gerenc") ? "gerencial" : "suporte",
        description: clean(row[col.description]),
        legal: clean(row[col.legal]),
        organizations: splitOrgs(row[4]),
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
      currentWorkProcess = null;
    }
    if (!currentTop) return;

    const source = clean(row[3]);
    const orgs = splitOrgs(row[4]);
    const situation = clean(row[col.situation]);
    currentTop.organizations.push(...orgs);
    if (source) currentTop.sources.push(source);
    if (situation) currentTop.situations.push(situation);

    const item = {
      name,
      description: clean(row[col.description]),
      legal: clean(row[col.legal]),
      basicUnit: clean(row[col.basicUnit]),
      complementaryUnit: clean(row[col.complementaryUnit]),
      organizations: orgs,
      source,
      situation,
      link: firstUrl(row[col.link]),
      type: "process",
      children: [],
    };
    if (arch.federal) item.federal = true;
    if (demoted.has(rowIndex)) item.note = "Na planilha consta como Processo; exibido como Processo de Trabalho.";

    if (kind === "finalistico" && architecture === "Macroprocesso") {
      item.type = "macroprocess";
      currentTop.hierarchy.push(item);
      currentMacroprocess = item;
      currentProcess = null;
      currentWorkProcess = null;
    }
    if (architecture === "Processo") {
      item.type = "process";
      currentTop.processes.push(item);
      (currentMacroprocess?.children ?? currentTop.hierarchy).push(item);
      currentProcess = item;
      currentWorkProcess = null;
    }
    if (architecture === "Processo de Trabalho") {
      item.type = source.toLocaleLowerCase("pt-BR").includes("carta de servi") ? "service" : "workProcess";
      if (item.type === "service") currentTop.services.push(item);
      else currentTop.workProcesses.push(item);
      if (!currentProcess) warnings.push(`[${sheetName}] linha ${rowIndex + 3}: Processo de Trabalho "${name}" sem Processo acima.`);
      (currentProcess?.children ?? currentMacroprocess?.children ?? currentTop.hierarchy).push(item);
      currentWorkProcess = item;
    }
    if (architecture === "Atividade") {
      item.type = "activity";
      currentTop.activities.push(item);
      // A atividade pertence ao Processo de Trabalho imediatamente acima dela.
      (currentWorkProcess?.children ?? currentProcess?.children ?? currentMacroprocess?.children ?? currentTop.hierarchy).push(item);
    }
  });
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
if (warnings.length) {
  console.log(`\n${warnings.length} inconsistência(s) encontradas na planilha:`);
  for (const warning of warnings) console.log(`  - ${warning}`);
}
console.log(`Gerados ${groups.length} grupos com ${groups.reduce((sum, group) => sum + group.processes.length + group.workProcesses.length, 0)} registros.`);
