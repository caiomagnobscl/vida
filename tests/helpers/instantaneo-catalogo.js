#!/usr/bin/env node
/**
 * Instantâneo do catálogo piloto (RNF006): resumo legível de cada regra — página do protocolo,
 * CIDs, grupos e exigências — guardado em tests/quality/instantaneo-catalogo.json.
 * É a única trava do CONTEÚDO do catálogo: os demais testes não dependem das regras reais (M-05).
 * Mudou o catálogo de propósito? Rode `node tests/helpers/instantaneo-catalogo.js`, revise o diff e faça o commit.
 * Uso: node tests/helpers/instantaneo-catalogo.js [--verificar]  (--verificar não grava; saída 1 se divergir)
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
export const CAMINHO_CATALOGO = path.join(RAIZ, 'servidor', 'banco', 'catalogo-inicial.json');
export const CAMINHO_INSTANTANEO = path.join(RAIZ, 'tests', 'quality', 'instantaneo-catalogo.json');

export function resumirCatalogo(bruto) {
  return {
    versao: bruto.versao,
    especialidades: bruto.especialidades ?? [],
    cidsGenericos: bruto.cidsGenericos,
    paginaDoFundamentoGenerico: bruto.fundamentoCidGenerico.paginaNoProtocolo,
    listaDeCidsGenericosCompleta: bruto.fundamentoCidGenerico.listaCompleta ?? false,
    regras: bruto.regras.map((r) => ({
      codigo: r.codigo,
      abrangencia: r.abrangencia,
      especialidade: r.especialidade ?? null,
      paginaNoProtocolo: r.paginaNoProtocolo,
      status: r.status ?? null,
      cidsAbrangidos: r.cidsAbrangidos ?? [],
      excecoes: r.excecoes ?? [],
      grupos: r.grupos.map((g) => ({
        modo: g.modo,
        exigencias: g.exigencias.map((e) => `${e.idExigencia} (${e.carater})`),
      })),
    })),
  };
}

export const serializar = (resumo) => `${JSON.stringify(resumo, null, 2)}\n`;

export async function lerResumoAtual() {
  return resumirCatalogo(JSON.parse(await readFile(CAMINHO_CATALOGO, 'utf8')));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const atual = serializar(await lerResumoAtual());
  if (process.argv.includes('--verificar')) {
    const guardado = await readFile(CAMINHO_INSTANTANEO, 'utf8').catch(() => '');
    console.log(guardado === atual ? 'Instantâneo em dia.' : 'Instantâneo desatualizado.');
    process.exitCode = guardado === atual ? 0 : 1;
  } else {
    await writeFile(CAMINHO_INSTANTANEO, atual);
    console.log(`Instantâneo gravado em ${path.relative(RAIZ, CAMINHO_INSTANTANEO)}.`);
  }
}
