using System.Text.RegularExpressions;
using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Autorizacao;

/// <summary>
/// Percorre TODAS as rotas de escrita da área Jotanunes registradas na API (constituição III/IV v1.1.0, SC-009):
/// cada uma está classificada como "exige administrador" ou "permitida ao comum"; rota nova sem classificação faz
/// o teste falhar. Usuário comum → 403 SEM_PERMISSAO antes de validar ou procurar o recurso, sem efeito de negócio;
/// administrador → sucesso do contrato (FR-081, FR-082, FR-083, US6/AC3–AC5).
/// </summary>
public class PerfilAdminTests(ApiFactory api) : TesteApi(api)
{
    public const string TituloSemPermissao = "Só administradores podem fazer isso. Se você precisa, fale com a TI.";

    /// <summary>Dados válidos semeados para as requisições de sucesso.</summary>
    private sealed record Cenario(Obra Obra, Empresa Empresa, Empresa EmpresaVinculada, TipoDocumento Tipo, TipoDocumento Tipo2,
        EnvioDocumento EnvioAprovar, EnvioDocumento EnvioRejeitar);

    private sealed record Operacao(HttpStatusCode Sucesso, Func<Cenario, (string Url, object? Corpo)> Valida);

    /// <summary>As 10 operações <c>x-requer-admin: true</c> do contrato, com a requisição válida e o status de sucesso.</summary>
    private static readonly Dictionary<Rota, Operacao> ExigemAdmin = new()
    {
        [new("POST", "/api/fluig/obras")] = new(HttpStatusCode.Created,
            _ => ("/api/fluig/obras", new { nome = "Obra criada no teste de perfil", cidade = "Aracaju", uf = "SE" })),
        [new("PUT", "/api/fluig/obras/{obraId}")] = new(HttpStatusCode.OK,
            c => ($"/api/fluig/obras/{c.Obra.Id}", new { nome = c.Obra.Nome + " editada", cidade = "Aracaju", uf = "SE", ativa = false })),
        [new("PUT", "/api/fluig/obras/{obraId}/empresas/{empresaId}")] = new(HttpStatusCode.NoContent,
            c => ($"/api/fluig/obras/{c.Obra.Id}/empresas/{c.Empresa.Id}", null)),
        [new("DELETE", "/api/fluig/obras/{obraId}/empresas/{empresaId}")] = new(HttpStatusCode.NoContent,
            c => ($"/api/fluig/obras/{c.Obra.Id}/empresas/{c.EmpresaVinculada.Id}", null)),
        [new("POST", "/api/fluig/empresas")] = new(HttpStatusCode.Created,
            _ => ("/api/fluig/empresas", new { razaoSocial = "Empresa criada no teste de perfil", cnpj = CnpjTeste.Gerar(), emailContato = "perfil@empresa.test" })),
        [new("PUT", "/api/fluig/empresas/{empresaId}")] = new(HttpStatusCode.OK,
            c => ($"/api/fluig/empresas/{c.Empresa.Id}", new { razaoSocial = c.Empresa.RazaoSocial + " editada", cnpj = c.Empresa.Cnpj, emailContato = c.Empresa.EmailContato, ativa = false })),
        [new("POST", "/api/fluig/tipos-documento")] = new(HttpStatusCode.Created,
            _ => ("/api/fluig/tipos-documento", new { nome = "Tipo criado no teste de perfil", instrucoes = "Envie o documento." })),
        [new("PUT", "/api/fluig/tipos-documento/{tipoDocumentoId}")] = new(HttpStatusCode.OK,
            c => ($"/api/fluig/tipos-documento/{c.Tipo.Id}", new { nome = c.Tipo.Nome + " editado", instrucoes = "Novas instruções", ativo = false })),
        [new("POST", "/api/fluig/envios/{envioId}/aprovar")] = new(HttpStatusCode.OK,
            c => ($"/api/fluig/envios/{c.EnvioAprovar.Id}/aprovar", null)),
        [new("POST", "/api/fluig/envios/{envioId}/rejeitar")] = new(HttpStatusCode.OK,
            c => ($"/api/fluig/envios/{c.EnvioRejeitar.Id}/rejeitar", new { motivo = "Documento ilegível, envie de novo" })),
    };

    /// <summary>Rotas de escrita liberadas explicitamente ao usuário comum (FR-082).</summary>
    private static readonly HashSet<Rota> PermitidasAoComum =
    [
        new("POST", "/api/fluig/empresas/{empresaId}/convites"),
    ];

    private HttpClient Comum() => Api.Cliente(token: Tokens.FluigComum(Api));

    private HttpClient Admin() => Api.Cliente(token: Tokens.Fluig(Api, "ana.admin", "Ana Admin"));

    private async Task<Cenario> SemearAsync()
    {
        var obra = await Semente.ObraAsync();
        var empresa = await Semente.EmpresaAsync();
        var vinculada = await Semente.EmpresaAsync();
        await Semente.VincularAsync(obra, vinculada);
        var tipo = await Semente.TipoAsync();
        var tipo2 = await Semente.TipoAsync();
        var aprovar = await Semente.EnvioAsync(empresa, tipo);
        var rejeitar = await Semente.EnvioAsync(empresa, tipo2);
        return new Cenario(obra, empresa, vinculada, tipo, tipo2, aprovar, rejeitar);
    }

    private static HttpRequestMessage Requisicao(Rota rota, string url, object? corpo)
    {
        var req = new HttpRequestMessage(new HttpMethod(rota.Metodo), url);
        if (corpo is not null) req.Content = JsonContent.Create(corpo);
        return req;
    }

    /// <summary>Todas as linhas das tabelas de negócio (qualquer inserção, alteração ou exclusão muda o resultado).</summary>
    private Task<List<string>> EstadoNegocioAsync() => Api.NoBancoAsync(db => db.Database.SqlQueryRaw<string>("""
        SELECT s.x AS "Value" FROM (
            SELECT 'obras ' || row_to_json(t)::text AS x FROM obras t
            UNION ALL SELECT 'empresas ' || row_to_json(t)::text FROM empresas t
            UNION ALL SELECT 'obra_empresas ' || row_to_json(t)::text FROM obra_empresas t
            UNION ALL SELECT 'tipos_documento ' || row_to_json(t)::text FROM tipos_documento t
            UNION ALL SELECT 'envios_documento ' || row_to_json(t)::text FROM envios_documento t
            UNION ALL SELECT 'convites ' || row_to_json(t)::text FROM convites t
        ) s ORDER BY s.x
        """).ToListAsync());

    private sealed record Contagens(int Obras, int Empresas, int Vinculos, int Tipos, int EmAnalise, int Aprovados, int Rejeitados, int Emails);

    private async Task<Contagens> ContarAsync() => await Api.NoBancoAsync(async db => new Contagens(
        await db.Obras.CountAsync(), await db.Empresas.CountAsync(), await db.ObraEmpresas.CountAsync(), await db.TiposDocumento.CountAsync(),
        await db.Envios.CountAsync(e => e.Status == StatusEnvio.EM_ANALISE), await db.Envios.CountAsync(e => e.Status == StatusEnvio.APROVADO),
        await db.Envios.CountAsync(e => e.Status == StatusEnvio.REJEITADO), Api.Emails.Mensagens.Count));

    private static async Task AssertSemPermissaoAsync(HttpResponseMessage r, string caso)
    {
        Assert.True(r.StatusCode == HttpStatusCode.Forbidden, $"{caso} → {(int)r.StatusCode}");
        Assert.Equal("SEM_PERMISSAO", await r.CodigoAsync());
        var j = await r.LerAsync();
        Assert.Equal(TituloSemPermissao, j.Str("title"));
        Assert.Equal(403, j.GetProperty("status").GetInt32());
    }

    [Fact]
    public void Toda_rota_de_escrita_fluig_esta_classificada()
    {
        var escrita = Rota.Registradas(Api)
            .Where(r => r.Padrao.StartsWith("/api/fluig/", StringComparison.Ordinal) && r.Metodo != "GET")
            .ToHashSet();
        var classificadas = ExigemAdmin.Keys.ToHashSet();
        Assert.Empty(classificadas.Intersect(PermitidasAoComum));
        classificadas.UnionWith(PermitidasAoComum);

        Assert.True(escrita.SetEquals(classificadas),
            $"Sem classificação: [{string.Join(", ", escrita.Except(classificadas))}]; classificadas mas não registradas: [{string.Join(", ", classificadas.Except(escrita))}]");
        Assert.Equal(10, ExigemAdmin.Count);
    }

    [Fact]
    public async Task Comum_recebe_403_antes_de_validar_corpo_ou_procurar_o_recurso()
    {
        var cliente = Comum();
        foreach (var rota in ExigemAdmin.Keys)
        {
            // Corpo {} (inválido) e ids aleatórios (inexistentes): 403, não 400 nem 404.
            await AssertSemPermissaoAsync(await cliente.SendAsync(rota.Requisicao(token: null)), rota.ToString());
        }
        Assert.Equal(ExigemAdmin.Count, await Api.NoBancoAsync(db => db.Auditoria.CountAsync(a => a.Acao == "PERMISSAO_NEGADA")));
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Auditoria.CountAsync(a => a.Acao != "PERMISSAO_NEGADA")));
    }

    [Fact]
    public async Task Comum_com_dados_validos_recebe_403_sem_nenhum_efeito_de_negocio()
    {
        var cenario = await SemearAsync();
        var estadoAntes = await EstadoNegocioAsync();
        var contagensAntes = await ContarAsync();
        var cliente = Comum();

        foreach (var (rota, op) in ExigemAdmin)
        {
            var (url, corpo) = op.Valida(cenario);
            await AssertSemPermissaoAsync(await cliente.SendAsync(Requisicao(rota, url, corpo)), rota.ToString());
        }

        Assert.Equal(contagensAntes, await ContarAsync());
        Assert.Equal(estadoAntes, await EstadoNegocioAsync());
        Assert.Empty(Api.Emails.Mensagens);
        // O único registro permitido é a tentativa na auditoria.
        Assert.Equal(ExigemAdmin.Count, await Api.NoBancoAsync(db => db.Auditoria.CountAsync(a => a.Acao == "PERMISSAO_NEGADA")));
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Auditoria.CountAsync(a => a.Acao != "PERMISSAO_NEGADA")));
    }

    [Fact]
    public async Task Admin_com_dados_validos_tem_sucesso_em_toda_operacao_de_administrador()
    {
        var falhas = new List<string>();
        foreach (var (rota, op) in ExigemAdmin)
        {
            await Api.LimparAsync();
            var (url, corpo) = op.Valida(await SemearAsync());
            var r = await Admin().SendAsync(Requisicao(rota, url, corpo));
            if (r.StatusCode != op.Sucesso) falhas.Add($"{rota} → {(int)r.StatusCode} {await r.Content.ReadAsStringAsync()}");
            if (await Api.NoBancoAsync(db => db.Auditoria.AnyAsync(a => a.Acao == "PERMISSAO_NEGADA"))) falhas.Add($"{rota} gravou PERMISSAO_NEGADA");
        }
        Assert.Empty(falhas);
    }

    [Fact]
    public async Task Comum_envia_convite_e_consulta_todas_as_rotas_de_leitura()
    {
        var c = await SemearAsync();
        var cliente = Comum();

        var convite = await cliente.PostAsync($"/api/fluig/empresas/{c.Empresa.Id}/convites", null);
        Assert.Equal(HttpStatusCode.Created, convite.StatusCode);
        Assert.Single(Api.Emails.Mensagens);

        var valores = new Dictionary<string, Guid>
        {
            ["obraId"] = c.Obra.Id,
            ["empresaId"] = c.Empresa.Id,
            ["tipoDocumentoId"] = c.Tipo.Id,
            ["envioId"] = c.EnvioAprovar.Id,
        };
        var leituras = Rota.Registradas(Api).Where(r => r.Padrao.StartsWith("/api/fluig/", StringComparison.Ordinal) && r.Metodo == "GET").ToList();
        Assert.True(leituras.Count >= 14, $"esperava as rotas GET do contrato, achou {leituras.Count}");

        var falhas = new List<string>();
        foreach (var rota in leituras)
        {
            var url = Regex.Replace(rota.Padrao, @"\{(\w+)\}", m => valores[m.Groups[1].Value].ToString());
            var r = await cliente.GetAsync(url);
            if (r.StatusCode != HttpStatusCode.OK) falhas.Add($"{rota} → {(int)r.StatusCode}");
        }
        Assert.Empty(falhas);
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Auditoria.CountAsync(a => a.Acao == "PERMISSAO_NEGADA")));
    }

    [Fact]
    public async Task Sem_token_continua_401_nas_operacoes_de_administrador()
    {
        var cliente = Anonimo();
        foreach (var rota in ExigemAdmin.Keys)
        {
            var r = await cliente.SendAsync(rota.Requisicao(token: null));
            Assert.True(r.StatusCode == HttpStatusCode.Unauthorized, $"{rota} → {(int)r.StatusCode}");
            Assert.Equal("NAO_AUTENTICADO", await r.CodigoAsync());
        }
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Auditoria.CountAsync()));
    }
}
