#!/usr/bin/env python3
"""Preenche o modelo da Entrega Parcial (LevelUp) com o conteúdo em Markdown.

Uso:
    python preencher_entrega.py [caminho_do_modelo.docx]

- Abre uma CÓPIA do modelo (o original nunca é alterado).
- Troca "XXXXXXXX" (EMPRESA) e "XX" (SQUAD) no cabeçalho, mantendo a formatação.
- Mantém todos os títulos e instruções do modelo e insere o conteúdo de cada
  âncora (<!-- ANCORA: N.N -->) logo após o último parágrafo de instrução do item.
- Gera docs/entrega-parcial/ENTREGA_PARCIAL_RIV_LEVELUP_2026.1_Squad81.docx.

Markdown aceito (restrito): parágrafos, **negrito**, *itálico*, `código`,
listas "- " e "1. ", "####" (subtítulo), tabelas pipe, imagens ![legenda](caminho)
e blocos de código ```. Comentários HTML que não sejam âncora são ignorados.
Dependências: python-docx, pillow.
"""
from __future__ import annotations

import copy
import os
import re
import shutil
import sys
import tempfile
import unicodedata

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Emu, Pt, RGBColor, Twips
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
MODELO_PADRAO = os.path.expanduser("~/Downloads/1. ENTREGA_PARCIAL_RIV_LEVELUP_2026.1 (1).docx")
SAIDA = os.path.join(AQUI, "ENTREGA_PARCIAL_RIV_LEVELUP_2026.1_Squad81.docx")
CONTEUDO = [os.path.join(AQUI, "conteudo", n) for n in ("secao-1-2.md", "secao-3-4.md", "secao-5.md")]

EMPRESA = "JOTANUNES CONSTRUTORA"
SQUAD = "81"

# Identidade do modelo (lida de styles.xml / document.xml / header1.xml)
FONTE = "Montserrat"          # fonte de todo o corpo do modelo
FONTE_MONO = "Courier New"
COR_TEXTO = "434343"          # cor do texto do corpo do modelo
COR_FAIXA = "01739D"          # azul-petróleo das faixas de título e do cabeçalho
COR_BORDA = "A6A6A6"
COR_CODIGO = "F2F2F2"
TAM_TEXTO = 10
TAM_TABELA = 8.5
TAM_CODIGO = 8
TAM_LEGENDA = 8.5

# Âncora -> início do texto (normalizado) do último parágrafo de instrução do item
ANCORAS = {
    "1.1": "Personas.",
    "1.2": "Identificar cenários de falha, casos críticos de erro.",
    "1.3": "Pelo menos uma entrevista com humanos.",
    "2.1": "Descrição dos padrões de uso de ferramentas de IA no projeto.",
    "2.2": "Definição clara dos critérios de aceitação",
    "3.1": "Identificar no modelo de dados quais entidades",
    "3.2": "Estrutura de requisições e respostas.",
    "3.3": "Exemplos de fluxo completo da requisição.",
    "3.4": "Limites de requisição, Latência, indisponibilidade, etc.",
    "4.1": "Detalhamento de stack",
    "4.2": "Como tratar problemas com latência, erros, timeout e indisponibilidade.",
    "5.1": "Problemas encontrados;",
    "5.2": "Como trabalharam, qual o impacto",
}
# Âncora -> início do título do subitem (de onde vem o recuo do bloco)
TITULOS = {
    "1.1": "1.1 - Descrição do Problema", "1.2": "1.2- Cenários de Uso", "1.3": "1.3- Entrevistas",
    "2.1": "2.1- Backlog", "2.2": "2.2- Histórias de Usuário",
    "3.1": "3.1- Representação", "3.2": "3.2- Design da API", "3.3": "3.3- Fluxo de dados",
    "3.4": "3.4- Tratamento de Exceções",
    "4.1": "4.1- Escolha da Stack", "4.2": "4.2- Desenho de Arquitetura",
    "5.1": "5.1- Repositório de Prompts", "5.2": "5.2- Relato do processo",
}


def norm(t: str) -> str:
    t = unicodedata.normalize("NFC", t).replace(" ", " ")
    return re.sub(r"\s+", " ", t).strip()


# --------------------------------------------------------------------------- Markdown

def ler_blocos() -> dict[str, list]:
    """Lê os .md e devolve {âncora: [blocos]} com o diretório base de cada um."""
    resultado: dict[str, tuple[str, list[str]]] = {}
    for caminho in CONTEUDO:
        texto = open(caminho, encoding="utf-8").read()
        partes = re.split(r"<!--\s*ANCORA:\s*([\d.]+)\s*-->", texto)
        for i in range(1, len(partes), 2):
            ancora = partes[i]
            if ancora in resultado:
                raise SystemExit(f"Âncora repetida: {ancora}")
            resultado[ancora] = (os.path.dirname(caminho), parse_md(partes[i + 1]))
    return resultado


def parse_md(texto: str) -> list[dict]:
    # remove comentários HTML (não-âncora), inclusive de várias linhas
    texto = re.sub(r"<!--.*?-->", "", texto, flags=re.S)
    linhas = texto.split("\n")
    blocos: list[dict] = []
    i = 0
    while i < len(linhas):
        ln = linhas[i]
        s = ln.strip()
        if not s:
            i += 1
            continue
        if s.startswith("```"):
            lang = s[3:].strip()
            corpo = []
            i += 1
            while i < len(linhas) and not linhas[i].strip().startswith("```"):
                corpo.append(linhas[i].rstrip())
                i += 1
            i += 1
            blocos.append({"t": "code", "lang": lang, "linhas": corpo})
            continue
        if s.startswith("#"):
            blocos.append({"t": "h", "texto": s.lstrip("#").strip()})
            i += 1
            continue
        m = re.match(r"!\[(.*?)\]\((.*?)\)\s*$", s)
        if m:
            blocos.append({"t": "img", "legenda": m.group(1), "src": m.group(2)})
            i += 1
            continue
        if s.startswith("|"):
            tab = []
            while i < len(linhas) and linhas[i].strip().startswith("|"):
                tab.append(linhas[i].strip())
                i += 1
            linhas_tab = [dividir_linha(r) for r in tab if not re.match(r"^\|[\s:|-]+\|$", r)]
            blocos.append({"t": "table", "linhas": linhas_tab})
            continue
        m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", ln)
        if m:
            ordenada = m.group(2)[0].isdigit()
            itens = []
            while i < len(linhas):
                m2 = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", linhas[i])
                if not m2:
                    break
                nivel = min(len(m2.group(1)) // 2, 1)
                if nivel == 0 and m2.group(2)[0].isdigit() != ordenada:
                    break
                itens.append({"texto": m2.group(3).strip(), "nivel": nivel})
                i += 1
            blocos.append({"t": "list", "ordenada": ordenada, "itens": itens})
            continue
        # parágrafo: junta linhas até linha vazia ou outro bloco
        par = [s]
        i += 1
        while i < len(linhas):
            p = linhas[i].strip()
            if not p or p.startswith(("#", "|", "```", "![")) or re.match(r"^([-*]|\d+\.)\s+", p):
                break
            par.append(p)
            i += 1
        blocos.append({"t": "p", "texto": " ".join(par)})
    return blocos


def dividir_linha(linha: str) -> list[str]:
    """Divide uma linha de tabela pipe em células, ignorando | dentro de `código`."""
    linha = linha.strip()
    if linha.startswith("|"):
        linha = linha[1:]
    if linha.endswith("|"):
        linha = linha[:-1]
    celulas, atual, em_codigo = [], [], False
    for ch in linha:
        if ch == "`":
            em_codigo = not em_codigo
        if ch == "|" and not em_codigo:
            celulas.append("".join(atual).strip())
            atual = []
        else:
            atual.append(ch)
    celulas.append("".join(atual).strip())
    return celulas


def tokens_inline(texto: str) -> list[tuple[str, bool, bool, bool]]:
    """Devolve [(texto, negrito, itálico, código)]."""
    out: list[tuple[str, bool, bool, bool]] = []
    b = it = False
    buf = []
    i = 0

    def flush():
        if buf:
            out.append(("".join(buf), b, it, False))
            buf.clear()

    while i < len(texto):
        if texto[i] == "`":
            j = texto.find("`", i + 1)
            if j > i:
                flush()
                out.append((texto[i + 1:j], b, it, True))
                i = j + 1
                continue
        if texto.startswith("**", i):
            flush()
            b = not b
            i += 2
            continue
        if texto[i] == "*" and (i + 1 < len(texto) and not texto[i + 1].isspace() or it):
            flush()
            it = not it
            i += 1
            continue
        buf.append(texto[i])
        i += 1
    flush()
    return out


# --------------------------------------------------------------------------- XML helpers

def set_fonte(run, nome=FONTE, tam=TAM_TEXTO, cor=COR_TEXTO, negrito=None, italico=None):
    rpr = run._r.get_or_add_rPr()
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = OxmlElement("w:rFonts")
        rpr.insert(0, rf)
    for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rf.set(qn(a), nome)
    run.font.size = Pt(tam)
    if cor:
        run.font.color.rgb = RGBColor.from_string(cor)
    if negrito is not None:
        run.font.bold = negrito
    if italico is not None:
        run.font.italic = italico


def quebraveis(t: str) -> str:
    """Insere espaço de largura zero depois de . / _ em identificadores longos,
    para a linha poder quebrar ali (evita espaçamento esticado no texto
    justificado e palavras partidas no meio dentro das tabelas)."""
    def trata(m):
        w = m.group(0)
        return re.sub(r"([._/])(?=[A-Za-z{])", "\\1\u200b", w) if len(w) > 10 else w
    return re.sub(r"\S+", trata, t)


def adicionar_inline(par, texto, tam=TAM_TEXTO, cor=COR_TEXTO, negrito_base=False):
    for t, b, it, cod in tokens_inline(texto):
        t = quebraveis(t)
        r = par.add_run(t)
        if cod:
            set_fonte(r, FONTE_MONO, tam - 0.5 if tam > 8 else tam, cor, negrito=b or negrito_base, italico=it)
        else:
            set_fonte(r, FONTE, tam, cor, negrito=b or negrito_base, italico=it)


def fmt_par(par, recuo, antes=0, depois=6, alinhamento=WD_ALIGN_PARAGRAPH.JUSTIFY, hanging=0):
    pf = par.paragraph_format
    pf.left_indent = Twips(recuo)
    if hanging:
        pf.first_line_indent = Twips(-hanging)
    else:
        pf.first_line_indent = Twips(0)
    pf.space_before = Pt(antes)
    pf.space_after = Pt(depois)
    pf.line_spacing = 1.15
    pf.alignment = alinhamento


def cell_shading(cell, cor):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), cor)
    tcpr.append(shd)


def tabela_props(tabela, larguras, recuo, cor_borda=COR_BORDA, sz=4):
    tbl = tabela._tbl
    tblpr = tbl.tblPr
    for tag in ("w:tblStyle", "w:tblW", "w:tblInd", "w:tblBorders", "w:tblLayout", "w:tblCellMar", "w:jc"):
        for e in tblpr.findall(qn(tag)):
            tblpr.remove(e)
    tw = OxmlElement("w:tblW")
    tw.set(qn("w:w"), str(sum(larguras)))
    tw.set(qn("w:type"), "dxa")
    tblpr.append(tw)
    ind = OxmlElement("w:tblInd")
    ind.set(qn("w:w"), str(int(recuo)))
    ind.set(qn("w:type"), "dxa")
    tblpr.append(ind)
    bord = OxmlElement("w:tblBorders")
    for lado in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement(f"w:{lado}")
        e.set(qn("w:val"), "single")
        e.set(qn("w:sz"), str(sz))
        e.set(qn("w:space"), "0")
        e.set(qn("w:color"), cor_borda)
        bord.append(e)
    tblpr.append(bord)
    lay = OxmlElement("w:tblLayout")
    lay.set(qn("w:type"), "fixed")
    tblpr.append(lay)
    mar = OxmlElement("w:tblCellMar")
    for lado, v in (("top", 30), ("left", 70), ("bottom", 30), ("right", 70)):
        e = OxmlElement(f"w:{lado}")
        e.set(qn("w:w"), str(v))
        e.set(qn("w:type"), "dxa")
        mar.append(e)
    tblpr.append(mar)
    # grid
    grid = tbl.tblGrid
    for gc, w in zip(grid.findall(qn("w:gridCol")), larguras):
        gc.set(qn("w:w"), str(w))
    for row in tabela.rows:
        for cell, w in zip(row.cells, larguras):
            cell.width = Twips(w)


# --------------------------------------------------------------------------- Montagem

class Montador:
    def __init__(self, doc: Document):
        self.doc = doc
        self.body = doc.element.body
        # o modelo usa valores fracionários em twips, que o python-docx não lê
        sectpr = self.body.findall(qn("w:sectPr"))[-1]
        pgsz, pgmar = sectpr.find(qn("w:pgSz")), sectpr.find(qn("w:pgMar"))
        f = lambda e, a: float(e.get(qn(a)))
        self.largura_util = int(f(pgsz, "w:w") - f(pgmar, "w:left") - f(pgmar, "w:right"))  # twips
        self.altura_util = int(f(pgsz, "w:h") - f(pgmar, "w:top") - f(pgmar, "w:bottom"))
        self.figura = 0
        self._preparar_numeracao()

    # ---- numeração (listas reais do Word)
    def _preparar_numeracao(self):
        numbering = self.doc.part.numbering_part.element
        ids_abs = [int(a.get(qn("w:abstractNumId"))) for a in numbering.findall(qn("w:abstractNum"))]
        ids_num = [int(n.get(qn("w:numId"))) for n in numbering.findall(qn("w:num"))]
        self._numbering = numbering
        self._prox_num = max(ids_num + [0]) + 1
        base = max(ids_abs + [0]) + 1
        self.abs_bullet = base
        self.abs_decimal = base + 1
        self._novo_abstract(base, "bullet")
        self._novo_abstract(base + 1, "decimal")
        self.num_bullet = self._novo_num(self.abs_bullet)

    def _novo_abstract(self, aid, tipo):
        a = OxmlElement("w:abstractNum")
        a.set(qn("w:abstractNumId"), str(aid))
        mlt = OxmlElement("w:multiLevelType")
        mlt.set(qn("w:val"), "hybridMultilevel")
        a.append(mlt)
        simbolos = ["•", "–", "•"]
        for nivel in range(3):
            lvl = OxmlElement("w:lvl")
            lvl.set(qn("w:ilvl"), str(nivel))
            st = OxmlElement("w:start"); st.set(qn("w:val"), "1"); lvl.append(st)
            nf = OxmlElement("w:numFmt")
            nf.set(qn("w:val"), "bullet" if tipo == "bullet" else ("decimal" if nivel == 0 else "lowerLetter"))
            lvl.append(nf)
            lt = OxmlElement("w:lvlText")
            lt.set(qn("w:val"), simbolos[nivel] if tipo == "bullet" else (f"%{nivel + 1}." if nivel == 0 else f"%{nivel + 1})"))
            lvl.append(lt)
            jc = OxmlElement("w:lvlJc"); jc.set(qn("w:val"), "left"); lvl.append(jc)
            ppr = OxmlElement("w:pPr")
            ind = OxmlElement("w:ind")
            ind.set(qn("w:left"), str(360 * (nivel + 1)))
            ind.set(qn("w:hanging"), "360")
            ppr.append(ind)
            lvl.append(ppr)
            rpr = OxmlElement("w:rPr")
            rf = OxmlElement("w:rFonts")
            fonte = "Arial" if tipo == "bullet" else FONTE
            for at in ("w:ascii", "w:hAnsi", "w:cs"):
                rf.set(qn(at), fonte)
            rpr.append(rf)
            cor = OxmlElement("w:color"); cor.set(qn("w:val"), COR_FAIXA if tipo == "bullet" else COR_TEXTO)
            rpr.append(cor)
            if tipo != "bullet":
                b = OxmlElement("w:b"); rpr.append(b)
            lvl.append(rpr)
            a.append(lvl)
        # abstractNum deve vir antes de todos os w:num
        primeiro_num = self._numbering.find(qn("w:num"))
        if primeiro_num is not None:
            primeiro_num.addprevious(a)
        else:
            self._numbering.append(a)

    def _novo_num(self, aid, reiniciar=False):
        n = OxmlElement("w:num")
        n.set(qn("w:numId"), str(self._prox_num))
        an = OxmlElement("w:abstractNumId")
        an.set(qn("w:val"), str(aid))
        n.append(an)
        if reiniciar:
            ov = OxmlElement("w:lvlOverride")
            ov.set(qn("w:ilvl"), "0")
            so = OxmlElement("w:startOverride")
            so.set(qn("w:val"), "1")
            ov.append(so)
            n.append(ov)
        self._numbering.append(n)
        self._prox_num += 1
        return self._prox_num - 1

    # ---- criação de elementos (no fim do corpo; depois são movidos)
    def _par(self):
        return self.doc.add_paragraph()

    def subtitulo(self, texto, recuo):
        p = self._par()
        fmt_par(p, recuo, antes=8, depois=4, alinhamento=WD_ALIGN_PARAGRAPH.LEFT)
        p.paragraph_format.keep_with_next = True
        adicionar_inline(p, texto, tam=10.5, cor=COR_FAIXA, negrito_base=True)
        return [p._p]

    def paragrafo(self, texto, recuo):
        p = self._par()
        fmt_par(p, recuo)
        adicionar_inline(p, texto)
        # "Rótulo:" isolado em negrito puxa o próximo bloco junto
        if re.fullmatch(r"\*\*[^*]+\*\*:?", texto.strip()) or texto.strip().endswith(":"):
            p.paragraph_format.keep_with_next = True
        return [p._p]

    def lista(self, bloco, recuo):
        els = []
        num = self._novo_num(self.abs_decimal, reiniciar=True) if bloco["ordenada"] else self.num_bullet
        n = len(bloco["itens"])
        for k, item in enumerate(bloco["itens"]):
            p = self._par()
            nivel = item["nivel"]
            esquerda = recuo + 360 * (nivel + 1)
            fmt_par(p, esquerda, depois=(6 if k == n - 1 else 3), hanging=360)
            ppr = p._p.get_or_add_pPr()
            numpr = OxmlElement("w:numPr")
            il = OxmlElement("w:ilvl"); il.set(qn("w:val"), str(nivel)); numpr.append(il)
            ni = OxmlElement("w:numId"); ni.set(qn("w:val"), str(num)); numpr.append(ni)
            ppr.insert(0, numpr) if ppr.find(qn("w:pStyle")) is None else ppr.find(qn("w:pStyle")).addnext(numpr)
            adicionar_inline(p, item["texto"])
            els.append(p._p)
        return els

    def _larguras(self, linhas, total):
        ncol = max(len(r) for r in linhas)
        pesos, minimos = [], []
        for c in range(ncol):
            cel = [re.sub(r"[*`]", "", r[c]) if c < len(r) else "" for r in linhas]
            comp = [len(x) for x in cel]
            media = sum(comp[1:]) / max(1, len(comp) - 1) if len(comp) > 1 else comp[0]
            maior = max(comp)
            palavra = max((len(w) for x in cel[1:] for w in x.split()), default=4)
            palavra_cab = max((len(w) for w in re.split(r"[\s/]+", cel[0]) if w), default=4)
            pesos.append(max(0.55 * media + 0.45 * min(maior, 70), 4))
            # cabeçalho em negrito não pode quebrar palavra; corpo até 14 caracteres
            minimos.append(max(min(palavra, 12) * 118, palavra_cab * 122) + 170)  # ~8,5 pt
        if sum(minimos) > total:  # mínimos não cabem: proporcional a eles
            larg = [int(total * m / sum(minimos)) for m in minimos]
        else:
            # distribuição proporcional aos pesos respeitando os mínimos
            fixos: dict[int, int] = {}
            while True:
                livres = [i for i in range(ncol) if i not in fixos]
                resto = total - sum(fixos.values())
                soma = sum(pesos[i] for i in livres)
                prop = {i: resto * pesos[i] / soma for i in livres}
                abaixo = [i for i in livres if prop[i] < minimos[i]]
                if not abaixo:
                    break
                for i in abaixo:
                    fixos[i] = minimos[i]
            larg = [fixos[i] if i in fixos else int(prop[i]) for i in range(ncol)]
        larg[-1] += total - sum(larg)
        return larg

    def tabela(self, linhas, recuo):
        ncol = max(len(r) for r in linhas)
        linhas = [r + [""] * (ncol - len(r)) for r in linhas]
        total = self.largura_util - recuo
        larg = self._larguras(linhas, total)
        t = self.doc._body.add_table(len(linhas), ncol, Twips(total))
        t.alignment = WD_TABLE_ALIGNMENT.LEFT
        tabela_props(t, larg, recuo)
        for i, r in enumerate(linhas):
            row = t.rows[i]
            trpr = row._tr.get_or_add_trPr()
            if i == 0:
                h = OxmlElement("w:tblHeader"); h.set(qn("w:val"), "true"); trpr.append(h)
            for j, txt in enumerate(r):
                cell = row.cells[j]
                p = cell.paragraphs[0]
                fmt_par(p, 0, antes=0, depois=0, alinhamento=WD_ALIGN_PARAGRAPH.LEFT)
                p.paragraph_format.line_spacing = 1.0
                if i == 0:
                    cell_shading(cell, COR_FAIXA)
                    adicionar_inline(p, txt, tam=TAM_TABELA, cor="FFFFFF", negrito_base=True)
                else:
                    adicionar_inline(p, txt, tam=TAM_TABELA)
        return [t._tbl, self._espaco(recuo)]

    def _espaco(self, recuo, pts=6):
        p = self._par()
        fmt_par(p, recuo, antes=0, depois=0)
        p.paragraph_format.line_spacing = Pt(pts)
        r = p.add_run("")
        set_fonte(r, tam=4)
        return p._p

    def codigo(self, bloco, recuo):
        total = self.largura_util - recuo
        linhas = bloco["linhas"] or [""]
        maior = max(len(l) for l in linhas)
        # largura de caractere do Courier New = 0,6 em; 1 pt = 20 twips; margens internas 240
        tam = TAM_CODIGO
        if maior:
            alvo = (total - 300) / (12 * maior)  # tamanho (pt) em que a maior linha cabe
            if 6 <= alvo < TAM_CODIGO:  # só reduz se evitar quebra sem ficar ilegível
                tam = int(alvo * 2) / 2
        t = self.doc._body.add_table(1, 1, Twips(total))
        tabela_props(t, [total], recuo, cor_borda="D9D9D9")
        cell = t.rows[0].cells[0]
        cell_shading(cell, COR_CODIGO)
        primeiro = True
        for ln in linhas:
            p = cell.paragraphs[0] if primeiro else cell.add_paragraph()
            primeiro = False
            fmt_par(p, 0, antes=0, depois=0, alinhamento=WD_ALIGN_PARAGRAPH.LEFT)
            p.paragraph_format.line_spacing = 1.0
            r = p.add_run(ln if ln else " ")
            set_fonte(r, FONTE_MONO, tam, "262626")
        return [t._tbl, self._espaco(recuo)]

    def imagem(self, bloco, recuo, base_dir):
        caminho = os.path.normpath(os.path.join(base_dir, bloco["src"]))
        if not os.path.exists(caminho):
            raise SystemExit(f"Imagem não encontrada: {caminho}")
        w, h = Image.open(caminho).size
        larg_max = (self.largura_util - recuo) / 1440  # pol
        alt_max = (self.altura_util / 1440) - 1.0     # deixa espaço para a legenda
        larg = larg_max
        if larg * h / w > alt_max:
            larg = alt_max * w / h
        p = self._par()
        fmt_par(p, recuo, antes=6, depois=2, alinhamento=WD_ALIGN_PARAGRAPH.CENTER)
        p.paragraph_format.keep_with_next = True
        p.add_run().add_picture(caminho, width=Emu(int(larg * 914400)))
        self.figura += 1
        c = self._par()
        fmt_par(c, recuo, antes=0, depois=8, alinhamento=WD_ALIGN_PARAGRAPH.CENTER)
        r = c.add_run(f"Figura {self.figura} – {bloco['legenda']}")
        set_fonte(r, FONTE, TAM_LEGENDA, "595959", italico=True)
        return [p._p, c._p]

    def montar(self, blocos, recuo, base_dir):
        els = [self._espaco(recuo, pts=6)]  # respiro entre a instrução e o conteúdo
        for k, b in enumerate(blocos):
            prox = blocos[k + 1]["t"] if k + 1 < len(blocos) else None
            inicio = len(els)
            if b["t"] == "h":
                els += self.subtitulo(b["texto"], recuo)
            elif b["t"] == "p":
                els += self.paragrafo(b["texto"], recuo)
            elif b["t"] == "list":
                els += self.lista(b, recuo)
            elif b["t"] == "table":
                els += self.tabela(b["linhas"], recuo)
            elif b["t"] == "code":
                els += self.codigo(b, recuo)
            elif b["t"] == "img":
                els += self.imagem(b, recuo, base_dir)
            # (blocos de código são curtos: aí o "manter com o próximo" é desejável)
            # O Pages empurra a tabela inteira para a página seguinte quando o
            # parágrafo anterior tem "manter com o próximo"; por isso só vale
            # entre parágrafos.
            if prox == "table" and b["t"] in ("h", "p") and len(els) > inicio:
                ppr = els[-1].find(qn("w:pPr"))
                kn = ppr.find(qn("w:keepNext")) if ppr is not None else None
                if kn is not None:
                    ppr.remove(kn)
        els.append(self._espaco(recuo, pts=10))
        return els


# --------------------------------------------------------------------------- Cabeçalho

def substituir_no_paragrafo(p_el, alvo, novo) -> bool:
    """Substitui `alvo` por `novo` no texto de um w:p, mesmo partido em vários runs.
    O texto novo fica no run onde o alvo começa (mantém a formatação dele)."""
    ts = [t for t in p_el.iter(qn("w:t"))]
    completo = "".join(t.text or "" for t in ts)
    pos = completo.find(alvo)
    if pos < 0:
        return False
    fim = pos + len(alvo)
    cursor = 0
    inserido = False
    for t in ts:
        txt = t.text or ""
        ini_t, fim_t = cursor, cursor + len(txt)
        cursor = fim_t
        if fim_t <= pos or ini_t >= fim:
            continue
        a = max(pos, ini_t) - ini_t
        b = min(fim, fim_t) - ini_t
        t.text = txt[:a] + ("" if inserido else novo) + txt[b:]
        t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        inserido = True
    return True


def preencher_cabecalho(doc):
    trocas = 0
    for rel in doc.part.rels.values():
        if not rel.reltype.endswith("/header"):
            continue
        el = rel.target_part.element
        for p in el.iter(qn("w:p")):
            texto = "".join(t.text or "" for t in p.iter(qn("w:t")))
            if "EMPRESA" in texto and "XXXXXXXX" in texto:
                trocas += substituir_no_paragrafo(p, "XXXXXXXX", EMPRESA)
            elif "SQUAD" in texto and re.search(r"SQUAD:\s*XX\b", texto):
                trocas += substituir_no_paragrafo(p, "XX", SQUAD)
    if trocas < 2:
        raise SystemExit(f"Cabeçalho: esperava 2 trocas, fiz {trocas}")
    return trocas


# --------------------------------------------------------------------------- Principal

def achar_paragrafo(body_pars, prefixo):
    alvo = norm(prefixo)
    achados = [p for p in body_pars if norm(p.text).startswith(alvo)]
    if len(achados) != 1:
        raise SystemExit(f"Esperava 1 parágrafo começando com {prefixo!r}, achei {len(achados)}")
    return achados[0]


def main():
    modelo = sys.argv[1] if len(sys.argv) > 1 else MODELO_PADRAO
    tmp = tempfile.mkdtemp()
    copia = os.path.join(tmp, "modelo.docx")
    shutil.copyfile(modelo, copia)  # nunca abre o original para escrita

    doc = Document(copia)
    preencher_cabecalho(doc)

    conteudo = ler_blocos()
    faltando = set(ANCORAS) - set(conteudo)
    sobrando = set(conteudo) - set(ANCORAS)
    if faltando or sobrando:
        raise SystemExit(f"Âncoras faltando {faltando} / desconhecidas {sobrando}")

    pars = list(doc.paragraphs)
    alvos = {a: achar_paragrafo(pars, t) for a, t in ANCORAS.items()}
    titulos = {a: achar_paragrafo(pars, t) for a, t in TITULOS.items()}

    m = Montador(doc)
    inseridas = []
    for ancora in ANCORAS:  # ordem do documento
        base_dir, blocos = conteudo[ancora]
        ind = titulos[ancora]._p.find(qn("w:pPr") + "/" + qn("w:ind"))
        recuo = int(round(float(ind.get(qn("w:left"))))) if ind is not None and ind.get(qn("w:left")) else 720
        els = m.montar(blocos, recuo, base_dir)
        cursor = alvos[ancora]._p
        for el in els:
            cursor.addnext(el)
            cursor = el
        inseridas.append(ancora)

    # Evita título de item/faixa sozinho no pé da página (só paginação; visual intacto)
    for k, p in enumerate(pars):
        t = norm(p.text)
        if re.match(r"^\d\.\s", t) or re.match(r"^\d\.\d\s?-", t):
            p.paragraph_format.keep_with_next = True
            j = k + 1  # parágrafos vazios logo após a faixa também seguram a corrente
            while j < len(pars) and not norm(pars[j].text):
                pars[j].paragraph_format.keep_with_next = True
                j += 1

    doc.save(SAIDA)
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"Âncoras inseridas ({len(inseridas)}/13): {', '.join(inseridas)}")
    print(f"Figuras: {m.figura}")
    print(f"Gerado: {SAIDA}")


if __name__ == "__main__":
    main()
