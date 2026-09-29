using System.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Desempenho;

/// <summary>SC-006: listas em ≤ 2 s com 50 obras, 500 empresas, 30 tipos e 20.000 envios.</summary>
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
                INSERT INTO tipos_documento (id, nome, ativo, criado_em, criado_por_login)
                  SELECT gen_random_uuid(), 'Tipo ' || lpad(g::text, 2, '0'), true, now(), 'perf' FROM generate_series(1, 30) g;
                INSERT INTO envios_documento (id, empresa_id, tipo_documento_id, nome_arquivo, content_type, tamanho_bytes, sha256, chave_armazenamento, enviado_em, status)
                  SELECT gen_random_uuid(), e.id, t.id, 'a.pdf', 'application/pdf', 100, repeat('0', 64), 'x',
                         now() - random() * interval '300 days', CASE WHEN random() < 0.5 THEN 'EM_ANALISE' ELSE 'APROVADO' END
                  FROM empresas e CROSS JOIN tipos_documento t;
                INSERT INTO envios_documento (id, empresa_id, tipo_documento_id, nome_arquivo, content_type, tamanho_bytes, sha256, chave_armazenamento, enviado_em, status, motivo_rejeicao)
                  SELECT gen_random_uuid(), x.eid, x.tid, 'a.pdf', 'application/pdf', 100, repeat('0', 64), 'x', now() - interval '301 days', 'REJEITADO', 'Documento ilegível'
                  FROM (SELECT e.id AS eid, t.id AS tid FROM empresas e CROSS JOIN tipos_documento t ORDER BY e.id, t.id LIMIT 5000) x;
                ANALYZE;
                """);
        });
        Assert.Equal(20_000, await Api.NoBancoAsync(db => db.Envios.CountAsync()));

        var empresa = await Api.NoBancoAsync(db => db.Empresas.AsNoTracking().OrderBy(e => e.RazaoSocial).FirstAsync());
        var portal = Api.Cliente(token: Tokens.Portal(Api, empresa.Id, empresa.Cnpj, empresa.VersaoCredencial, false));
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
