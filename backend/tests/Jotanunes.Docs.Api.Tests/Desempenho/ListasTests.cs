using System.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Desempenho;

/// <summary>
/// SC-006: listas em ≤ 2 s com 50 obras, 500 empresas, 30 tipos e 20.000 envios gerais — mais (002) 5 tipos por obra
/// marcados em todas as obras e 2.500 envios por obra (um por vínculo × tipo) — mais (003) 2 tipos gerais mensais e 1 por
/// obra mensal cobrados há 2 anos (25 períodos), com ~2/3 dos períodos enviados (≈ 33.000 envios periódicos).
/// </summary>
[Trait("Categoria", "Desempenho")]
public class ListasTests(ApiFactory api) : TesteApi(api)
{
    private static readonly TimeSpan Limite = TimeSpan.FromSeconds(2);

    [Fact]
    public async Task Listas_abaixo_de_2_segundos_com_volume_de_producao()
    {
        await Api.NoBancoAsync(async db =>
        {
            await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO obras (id, nome, codigo, cidade, uf, ativa, criado_em, criado_por_login)
                  SELECT gen_random_uuid(), 'Obra ' || g, 'OB' || g, 'Aracaju', 'SE', true, now(), 'perf' FROM generate_series(1, 50) g;
                INSERT INTO empresas (id, razao_social, cnpj, email_contato, ativa, troca_senha_obrigatoria, versao_credencial, tentativas_falhas, criado_em, criado_por_login, senha_hash)
                  SELECT gen_random_uuid(), 'Empresa ' || lpad(g::text, 4, '0'), lpad(g::text, 14, '0'), 'e' || g || '@perf.test', true, false, 0, 0, now(), 'perf', 'x'
                  FROM generate_series(1, 500) g;
                INSERT INTO obra_empresas (obra_id, empresa_id, vinculado_em, vinculado_por_login)
                  SELECT o.id, e.id, now(), 'perf'
                  FROM (SELECT id, row_number() OVER (ORDER BY nome) - 1 AS n FROM obras) o
                  JOIN (SELECT id, row_number() OVER (ORDER BY razao_social) AS n FROM empresas) e ON e.n % 50 = o.n;
                INSERT INTO tipos_documento (id, nome, ativo, criado_em, cobranca_desde, criado_por_login)
                  SELECT gen_random_uuid(), 'Tipo ' || lpad(g::text, 2, '0'), true, now(), now(), 'perf' FROM generate_series(1, 30) g;
                INSERT INTO envios_documento (id, empresa_id, tipo_documento_id, nome_arquivo, content_type, tamanho_bytes, sha256, chave_armazenamento, enviado_em, status)
                  SELECT gen_random_uuid(), e.id, t.id, 'a.pdf', 'application/pdf', 100, repeat('0', 64), 'x',
                         now() - random() * interval '300 days', CASE WHEN random() < 0.5 THEN 'EM_ANALISE' ELSE 'APROVADO' END
                  FROM empresas e CROSS JOIN tipos_documento t;
                INSERT INTO envios_documento (id, empresa_id, tipo_documento_id, nome_arquivo, content_type, tamanho_bytes, sha256, chave_armazenamento, enviado_em, status, motivo_rejeicao)
                  SELECT gen_random_uuid(), x.eid, x.tid, 'a.pdf', 'application/pdf', 100, repeat('0', 64), 'x', now() - interval '301 days', 'REJEITADO', 'Documento ilegível'
                  FROM (SELECT e.id AS eid, t.id AS tid FROM empresas e CROSS JOIN tipos_documento t ORDER BY e.id, t.id LIMIT 5000) x;
                INSERT INTO tipos_documento (id, nome, abrangencia, ativo, criado_em, cobranca_desde, criado_por_login)
                  SELECT gen_random_uuid(), 'Tipo obra ' || g, 'POR_OBRA', true, now(), now(), 'perf' FROM generate_series(1, 5) g;
                INSERT INTO obra_tipos_documento (obra_id, tipo_documento_id, marcado_em, marcado_por_login)
                  SELECT o.id, t.id, now(), 'perf' FROM obras o CROSS JOIN tipos_documento t WHERE t.abrangencia = 'POR_OBRA';
                INSERT INTO envios_documento (id, empresa_id, tipo_documento_id, obra_id, nome_arquivo, content_type, tamanho_bytes, sha256, chave_armazenamento, enviado_em, status)
                  SELECT gen_random_uuid(), v.empresa_id, m.tipo_documento_id, v.obra_id, 'a.pdf', 'application/pdf', 100, repeat('0', 64), 'x',
                         now() - random() * interval '300 days', CASE WHEN random() < 0.5 THEN 'EM_ANALISE' ELSE 'APROVADO' END
                  FROM obra_empresas v JOIN obra_tipos_documento m ON m.obra_id = v.obra_id;
                -- 003: tipos mensais (2 gerais + 1 por obra marcado em todas as obras), cobrados desde 24 meses atrás.
                UPDATE empresas SET criado_em = now() - interval '3 years';
                UPDATE obra_empresas SET vinculado_em = now() - interval '3 years';
                INSERT INTO tipos_documento (id, nome, abrangencia, periodicidade_unidade, periodicidade_intervalo, prazo_dias, ativo, criado_em, cobranca_desde, criado_por_login)
                  SELECT gen_random_uuid(), 'Mensal ' || g, CASE WHEN g = 3 THEN 'POR_OBRA' ELSE 'GERAL' END, 'MESES', 1, 15, true,
                         now() - interval '24 months', now() - interval '24 months', 'perf' FROM generate_series(1, 3) g;
                INSERT INTO obra_tipos_documento (obra_id, tipo_documento_id, marcado_em, marcado_por_login)
                  SELECT o.id, t.id, now() - interval '3 years', 'perf' FROM obras o CROSS JOIN tipos_documento t
                  WHERE t.abrangencia = 'POR_OBRA' AND t.periodicidade_unidade = 'MESES';
                INSERT INTO envios_documento (id, empresa_id, tipo_documento_id, nome_arquivo, content_type, tamanho_bytes, sha256, chave_armazenamento, enviado_em, status, periodo_inicio, periodo_fim)
                  SELECT gen_random_uuid(), e.id, t.id, 'g.pdf', 'application/pdf', 100, repeat('0', 64), 'x', now(),
                         CASE WHEN random() < 0.5 THEN 'EM_ANALISE' ELSE 'APROVADO' END, p::date, (p + interval '1 month' - interval '1 day')::date
                  FROM empresas e
                  CROSS JOIN tipos_documento t
                  CROSS JOIN generate_series(date_trunc('month', now() - interval '24 months'), date_trunc('month', now()), interval '1 month') p
                  WHERE t.abrangencia = 'GERAL' AND t.periodicidade_unidade = 'MESES' AND random() < 0.66;
                INSERT INTO envios_documento (id, empresa_id, tipo_documento_id, obra_id, nome_arquivo, content_type, tamanho_bytes, sha256, chave_armazenamento, enviado_em, status, periodo_inicio, periodo_fim)
                  SELECT gen_random_uuid(), v.empresa_id, m.tipo_documento_id, v.obra_id, 'g.pdf', 'application/pdf', 100, repeat('0', 64), 'x', now(),
                         'APROVADO', p::date, (p + interval '1 month' - interval '1 day')::date
                  FROM obra_empresas v
                  JOIN obra_tipos_documento m ON m.obra_id = v.obra_id
                  JOIN tipos_documento t ON t.id = m.tipo_documento_id AND t.periodicidade_unidade = 'MESES'
                  CROSS JOIN generate_series(date_trunc('month', now() - interval '24 months'), date_trunc('month', now()), interval '1 month') p
                  WHERE random() < 0.66;
                ANALYZE;
                """);
        });
        Assert.Equal(20_000, await Api.NoBancoAsync(db => db.Envios.CountAsync(e => e.ObraId == null && e.PeriodoInicio == null)));
        Assert.Equal(2_500, await Api.NoBancoAsync(db => db.Envios.CountAsync(e => e.ObraId != null && e.PeriodoInicio == null)));
        Assert.True(await Api.NoBancoAsync(db => db.Envios.CountAsync(e => e.PeriodoInicio != null)) > 20_000);
        var mensalGeral = await Api.NoBancoAsync(db => db.TiposDocumento.AsNoTracking().Where(t => t.Nome == "Mensal 1").Select(t => t.Id).SingleAsync());
        var mensalObra = await Api.NoBancoAsync(db => db.TiposDocumento.AsNoTracking().Where(t => t.Nome == "Mensal 3").Select(t => t.Id).SingleAsync());

        var empresa = await Api.NoBancoAsync(db => db.Empresas.AsNoTracking().OrderBy(e => e.RazaoSocial).FirstAsync());
        var portal = Api.Cliente(token: Tokens.Portal(Api, empresa.Id, empresa.Cnpj, empresa.VersaoCredencial, false));
        var obra = await Api.NoBancoAsync(db => db.ObraEmpresas.AsNoTracking().Where(v => v.EmpresaId == empresa.Id).Select(v => v.ObraId).FirstAsync());
        var fluig = Fluig();

        var urls = new (HttpClient Cliente, string Url)[]
        {
            (fluig, "/api/fluig/empresas"),
            (fluig, "/api/fluig/empresas?tamanhoPagina=100"),
            (fluig, "/api/fluig/empresas?comPendencia=true&tamanhoPagina=100"),
            (fluig, "/api/fluig/empresas?busca=empresa%2002"),
            (fluig, "/api/fluig/envios"),
            (fluig, "/api/fluig/envios?tamanhoPagina=100&pagina=50"),
            (fluig, "/api/fluig/obras?tamanhoPagina=100"),
            (fluig, "/api/fluig/painel"),
            (portal, "/api/portal/documentos"),
            // 002: documentos por obra
            (fluig, "/api/fluig/obras?comPendencia=true&tamanhoPagina=100"),
            (fluig, $"/api/fluig/obras/{obra}"),
            (fluig, $"/api/fluig/empresas?obraId={obra}&tamanhoPagina=100"),
            (fluig, $"/api/fluig/empresas/{empresa.Id}"),
            (fluig, $"/api/fluig/envios?obraId={obra}&tamanhoPagina=100"),
            (fluig, "/api/fluig/envios?somenteGerais=true&tamanhoPagina=100"),
            (fluig, $"/api/fluig/obras/{obra}/empresas/{empresa.Id}/documentos"),
            (portal, "/api/portal/obras"),
            (portal, $"/api/portal/obras/{obra}/documentos"),
            // 003: documentos periódicos
            (fluig, "/api/fluig/empresas?comAtraso=true&tamanhoPagina=100"),
            (fluig, "/api/fluig/envios?comAtraso=true&tamanhoPagina=100"),
            (fluig, $"/api/fluig/empresas/{empresa.Id}/documentos"),
            (fluig, $"/api/fluig/empresas/{empresa.Id}/documentos/{mensalGeral}/periodos"),
            (fluig, $"/api/fluig/obras/{obra}/empresas/{empresa.Id}/documentos/{mensalObra}/periodos"),
            (portal, $"/api/portal/documentos/{mensalGeral}/periodos"),
            (portal, $"/api/portal/obras/{obra}/documentos/{mensalObra}/periodos"),
        };
        await fluig.GetAsync("/api/fluig/empresas"); // aquecimento
        foreach (var (cliente, url) in urls)
        {
            var sw = Stopwatch.StartNew();
            var r = await cliente.GetAsync(url);
            sw.Stop();
            Assert.True(r.StatusCode == HttpStatusCode.OK, $"{url} → {(int)r.StatusCode}");
            Assert.True(sw.Elapsed < Limite, $"{url} levou {sw.ElapsedMilliseconds} ms");
        }
    }
}
