using System.Text.RegularExpressions;
using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;
using Jotanunes.Docs.Domain.UsuariosInternos;
using Jotanunes.Docs.Api.Autenticacao;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jotanunes.Docs.Api.Tests.Autorizacao;

/// <summary>
/// Percorre TODAS as rotas da área Jotanunes registradas na API (constituição III/IV v1.2.0, SC-009, SC-012): toda rota
/// de escrita está classificada como "exige administrador", "permitida ao comum", "anônima" ou "sessão", e todo GET
/// <c>x-requer-admin</c> está em "exige administrador"; rota nova sem classificação faz o teste falhar. Usuário comum →
/// 403 SEM_PERMISSAO antes de validar ou procurar o recurso, sem efeito de negócio; administrador → sucesso do
/// contrato (FR-081–FR-083, FR-107, FR-108, US6/AC3–AC5). Os cenários rodam para as DUAS origens de token: Fluig e
/// login próprio.
/// </summary>
public class PerfilAdminTests(ApiFactory api) : TesteApi(api)
{
    public const string TituloSemPermissao = "Só administradores podem fazer isso. Se você precisa, fale com a TI.";

    /// <summary>Dados válidos semeados para as requisições de sucesso.</summary>
    private sealed record Cenario(Obra Obra, Empresa Empresa, Empresa EmpresaVinculada, TipoDocumento Tipo, TipoDocumento Tipo2,
        EnvioDocumento EnvioAprovar, EnvioDocumento EnvioRejeitar, UsuarioInterno Usuario);

    private sealed record Operacao(HttpStatusCode Sucesso, Func<Cenario, (string Url, object? Corpo)> Valida);

    /// <summary>As 15 operações <c>x-requer-admin: true</c> do contrato, com a requisição válida e o status de sucesso.</summary>
    private static readonly Dictionary<Rota, Operacao> ExigemAdmin = new()
    {
        [new("GET", "/api/fluig/usuarios")] = new(HttpStatusCode.OK, _ => ("/api/fluig/usuarios", null)),
        [new("POST", "/api/fluig/usuarios")] = new(HttpStatusCode.Created,
            _ => ("/api/fluig/usuarios", new { login = "novo.perfil", nome = "Novo Perfil", email = "novo.perfil@jotanunes.com" })),
        [new("GET", "/api/fluig/usuarios/{usuarioId}")] = new(HttpStatusCode.OK, c => ($"/api/fluig/usuarios/{c.Usuario.Id}", null)),
        [new("PUT", "/api/fluig/usuarios/{usuarioId}")] = new(HttpStatusCode.OK,
            c => ($"/api/fluig/usuarios/{c.Usuario.Id}", new { nome = c.Usuario.Nome + " editado", email = c.Usuario.Email, admin = false, ativo = false })),
        [new("POST", "/api/fluig/usuarios/{usuarioId}/redefinir-senha")] = new(HttpStatusCode.OK,
            c => ($"/api/fluig/usuarios/{c.Usuario.Id}/redefinir-senha", null)),
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

    /// <summary>Rotas sem autenticação (login próprio, research R17).</summary>
    public static readonly HashSet<Rota> Anonimas =
    [
        new("GET", "/api/fluig/auth/configuracao"),
        new("POST", "/api/fluig/auth/login"),
    ];

    /// <summary>Rotas da sessão: qualquer usuário autenticado, inclusive com troca de senha pendente.</summary>
    public static readonly HashSet<Rota> Sessao =
    [
        new("GET", "/api/fluig/me"),
        new("POST", "/api/fluig/auth/trocar-senha"),
        new("POST", "/api/fluig/auth/sair"),
    ];

    public const string OrigemFluig = "FLUIG";
    public const string OrigemLocal = "LOGIN_LOCAL";

    public static TheoryData<string> Origens => new() { OrigemFluig, OrigemLocal };

    private async Task<HttpClient> ComumAsync(string origem) => Api.Cliente(token: origem == OrigemFluig
        ? Tokens.FluigComum(Api)
        : await Tokens.LocalComumAsync(Api, "joao.comum", "João Comum"));

    private async Task<HttpClient> AdminAsync(string origem) => Api.Cliente(token: origem == OrigemFluig
        ? Tokens.Fluig(Api, "ana.admin", "Ana Admin")
        : await Tokens.LocalAdminAsync(Api, "ana.admin", "Ana Admin"));

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
        var usuario = await Semente.UsuarioInternoAsync("alvo.perfil", "Alvo Perfil");
        return new Cenario(obra, empresa, vinculada, tipo, tipo2, aprovar, rejeitar, usuario);
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
            UNION ALL SELECT 'usuarios_internos ' || row_to_json(t)::text FROM usuarios_internos t
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
        var fluig = Rota.Registradas(Api).Where(r => r.Padrao.StartsWith("/api/fluig/", StringComparison.Ordinal)).ToList();
        var escrita = fluig.Where(r => r.Metodo != "GET").ToHashSet();
        var listas = new[] { ExigemAdmin.Keys.ToHashSet(), PermitidasAoComum, Anonimas, Sessao };
        var classificadas = new HashSet<Rota>();
        foreach (var lista in listas)
        {
            Assert.Empty(classificadas.Intersect(lista)); // cada rota em uma lista só
            classificadas.UnionWith(lista);
        }

        Assert.Empty(escrita.Except(classificadas));
        Assert.Empty(classificadas.Except(fluig));
        Assert.Equal(15, ExigemAdmin.Count);
    }

    [Fact]
    public void Todo_get_com_politica_de_administrador_esta_em_ExigemAdmin_e_vice_versa()
    {
        var comPolitica = Api.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(e => e.Metadata.GetOrderedMetadata<IAuthorizeData>().Any(a => a.Policy == Politicas.FluigAdmin))
            .SelectMany(e => (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? []).Select(m => new Rota(m, "/" + e.RoutePattern.RawText!.TrimStart('/'))))
            .ToHashSet();
        Assert.True(comPolitica.SetEquals(ExigemAdmin.Keys), $"diferença: [{string.Join(", ", comPolitica.Except(ExigemAdmin.Keys).Concat(ExigemAdmin.Keys.Except(comPolitica)))}]");
        Assert.Equal(2, comPolitica.Count(r => r.Metodo == "GET"));
    }

    [Theory]
    [MemberData(nameof(Origens))]
    public async Task Comum_recebe_403_antes_de_validar_corpo_ou_procurar_o_recurso(string origem)
    {
        var cliente = await ComumAsync(origem);
        foreach (var rota in ExigemAdmin.Keys)
        {
            // Corpo {} (inválido) e ids aleatórios (inexistentes): 403, não 400 nem 404.
            await AssertSemPermissaoAsync(await cliente.SendAsync(rota.Requisicao(token: null)), rota.ToString());
        }
        Assert.Equal(ExigemAdmin.Count, await Api.NoBancoAsync(db => db.Auditoria.CountAsync(a => a.Acao == "PERMISSAO_NEGADA")));
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Auditoria.CountAsync(a => a.Acao != "PERMISSAO_NEGADA")));
    }

    [Theory]
    [MemberData(nameof(Origens))]
    public async Task Comum_com_dados_validos_recebe_403_sem_nenhum_efeito_de_negocio(string origem)
    {
        var cliente = await ComumAsync(origem);
        var cenario = await SemearAsync();
        var estadoAntes = await EstadoNegocioAsync();
        var contagensAntes = await ContarAsync();

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

    [Theory]
    [MemberData(nameof(Origens))]
    public async Task Admin_com_dados_validos_tem_sucesso_em_toda_operacao_de_administrador(string origem)
    {
        var falhas = new List<string>();
        foreach (var (rota, op) in ExigemAdmin)
        {
            await Api.LimparAsync();
            var admin = await AdminAsync(origem);
            var (url, corpo) = op.Valida(await SemearAsync());
            var r = await admin.SendAsync(Requisicao(rota, url, corpo));
            if (r.StatusCode != op.Sucesso) falhas.Add($"{rota} → {(int)r.StatusCode} {await r.Content.ReadAsStringAsync()}");
            if (await Api.NoBancoAsync(db => db.Auditoria.AnyAsync(a => a.Acao == "PERMISSAO_NEGADA"))) falhas.Add($"{rota} gravou PERMISSAO_NEGADA");
        }
        Assert.Empty(falhas);
    }

    [Theory]
    [MemberData(nameof(Origens))]
    public async Task Comum_envia_convite_e_consulta_todas_as_rotas_de_leitura(string origem)
    {
        var cliente = await ComumAsync(origem);
        var c = await SemearAsync();

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
        var leituras = Rota.Registradas(Api)
            .Where(r => r.Padrao.StartsWith("/api/fluig/", StringComparison.Ordinal) && r.Metodo == "GET" && !ExigemAdmin.ContainsKey(r))
            .ToList();
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
