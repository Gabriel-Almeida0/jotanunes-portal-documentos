using System.Reflection;
using Jotanunes.Docs.Api.Autenticacao;
using Jotanunes.Docs.Api.Infra;
using Jotanunes.Docs.Api.Tests.Autorizacao;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Domain.Convites;
using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Microsoft.OpenApi.Readers;

namespace Jotanunes.Docs.Api.Tests.Contrato;

/// <summary>
/// Confere a API contra specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml (fonte de verdade):
/// rotas+métodos (nos dois sentidos), operationId, enums e propriedades dos schemas.
/// </summary>
public class ContratoOpenApiTests(ApiFactory api) : TesteApi(api)
{
    private static readonly Lazy<OpenApiDocument> Documento = new(() =>
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "specs", "001-portal-documentos-terceirizadas", "contracts", "openapi.yaml")))
        {
            dir = dir.Parent;
        }
        Assert.NotNull(dir);
        using var s = File.OpenRead(Path.Combine(dir!.FullName, "specs", "001-portal-documentos-terceirizadas", "contracts", "openapi.yaml"));
        var doc = new OpenApiStreamReader().Read(s, out var diag);
        Assert.Empty(diag.Errors);
        return doc;
    });

    private static IReadOnlyList<(Rota Rota, string OperationId)> RotasContrato() =>
        Documento.Value.Paths
            .SelectMany(p => p.Value.Operations.Select(o => (new Rota(o.Key.ToString().ToUpperInvariant(), p.Key), o.Value.OperationId)))
            .ToList();

    [Fact]
    public void Contrato_tem_34_operacoes()
    {
        Assert.Equal(34, RotasContrato().Count);
    }

    [Fact]
    public void Cada_rota_do_contrato_existe_na_api_e_vice_versa()
    {
        var contrato = RotasContrato().Select(r => r.Rota).ToHashSet();
        var api = Rota.Registradas(Api).ToHashSet();
        Assert.Empty(contrato.Except(api));
        Assert.Empty(api.Except(contrato));
    }

    [Fact]
    public void OperationId_do_contrato_e_o_nome_do_endpoint()
    {
        var nomes = Api.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .SelectMany(e => (e.Metadata.GetMetadata<Microsoft.AspNetCore.Routing.HttpMethodMetadata>()?.HttpMethods ?? [])
                .Select(m => (Rota: new Rota(m, "/" + e.RoutePattern.RawText!.TrimStart('/')), Nome: e.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName)))
            .ToDictionary(x => x.Rota, x => x.Nome);
        foreach (var (rota, operationId) in RotasContrato()) Assert.Equal(operationId, nomes[rota]);
    }

    [Fact]
    public void Operacoes_x_requer_admin_sao_exatamente_as_rotas_com_a_politica_FluigAdmin()
    {
        var contrato = Documento.Value.Paths.Values
            .SelectMany(p => p.Operations.Values)
            .Where(o => o.Extensions.TryGetValue("x-requer-admin", out var ext) && ext is OpenApiBoolean { Value: true })
            .Select(o => o.OperationId)
            .ToHashSet();
        Assert.Equal(10, contrato.Count);

        var api = Api.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .Where(e => e.Metadata.GetOrderedMetadata<IAuthorizeData>().Any(a => a.Policy == Politicas.FluigAdmin))
            .Select(e => e.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName ?? e.DisplayName ?? "?")
            .ToHashSet();

        Assert.Equal(contrato.OrderBy(x => x), api.OrderBy(x => x));
    }

    private static string[] EnumContrato(string schema) =>
        Documento.Value.Components.Schemas[schema].Enum.Select(e => ((OpenApiString)e).Value).ToArray();

    [Fact]
    public void Enums_iguais_ao_contrato()
    {
        Assert.Equal(EnumContrato("CodigoErro"), Enum.GetNames<CodigoErro>());
        Assert.Equal(EnumContrato("SituacaoAcesso"), Enum.GetNames<SituacaoAcesso>());
        Assert.Equal(EnumContrato("SituacaoConvite"), Enum.GetNames<SituacaoConvite>());
        Assert.Equal(EnumContrato("StatusEnvio"), Enum.GetNames<StatusEnvio>());
        Assert.Equal(EnumContrato("SituacaoDocumento"), Enum.GetNames<SituacaoDocumento>());
        Assert.Equal(EnumContrato("Uf"), Enum.GetNames<Uf>());
    }

    [Fact]
    public void Titulos_de_erro_iguais_a_tabela_do_contrato()
    {
        var descricao = Documento.Value.Components.Schemas["CodigoErro"].Description;
        foreach (var codigo in Enum.GetValues<CodigoErro>())
        {
            var (status, titulo) = CatalogoErros.Obter(codigo);
            var linha = descricao.Split('\n').Single(l => l.StartsWith($"| {codigo} |", StringComparison.Ordinal));
            Assert.Contains($"| {titulo} |", linha);
            Assert.Contains(status.ToString(), linha);
        }
    }

    private static HashSet<string> Propriedades(OpenApiSchema s)
    {
        var props = new HashSet<string>(s.Properties.Keys);
        foreach (var parte in s.AllOf) props.UnionWith(Propriedades(parte));
        return props;
    }

    private static HashSet<string> Obrigatorias(OpenApiSchema s)
    {
        var req = new HashSet<string>(s.Required);
        foreach (var parte in s.AllOf) req.UnionWith(Obrigatorias(parte));
        return req;
    }

    public static TheoryData<Type, string> Schemas => new()
    {
        { typeof(UsuarioFluigDto), "UsuarioFluig" },
        { typeof(AutorFluigDto), "AutorFluig" },
        { typeof(PainelDto), "Painel" },
        { typeof(ContagemDocumentosDto), "ContagemDocumentos" },
        { typeof(ObraDto), "Obra" },
        { typeof(ObraResumoDto), "ObraResumo" },
        { typeof(ObraDetalheDto), "ObraDetalhe" },
        { typeof(ObraRefDto), "ObraRef" },
        { typeof(EmpresaNaObraDto), "EmpresaNaObra" },
        { typeof(EmpresaResumoDto), "EmpresaResumo" },
        { typeof(EmpresaDto), "Empresa" },
        { typeof(EmpresaRefDto), "EmpresaRef" },
        { typeof(ConviteDto), "Convite" },
        { typeof(ConviteValidacaoDto), "ConviteValidacao" },
        { typeof(TipoDocumentoDto), "TipoDocumento" },
        { typeof(TipoDocumentoRefDto), "TipoDocumentoRef" },
        { typeof(EnvioDto), "Envio" },
        { typeof(EnvioFilaDto), "EnvioFila" },
        { typeof(DocumentoSituacaoDto), "DocumentoSituacao" },
        { typeof(EmpresaPortalDto), "EmpresaPortal" },
        { typeof(SessaoPortalDto), "SessaoPortal" },
        { typeof(EnvioPortalDto), "EnvioPortal" },
        { typeof(DocumentoSituacaoPortalDto), "DocumentoSituacaoPortal" },
        { typeof(Problema), "Problema" },
        { typeof(ObraInput), "ObraAtualizacao" },
        { typeof(EmpresaInput), "EmpresaAtualizacao" },
        { typeof(TipoDocumentoInput), "TipoDocumentoAtualizacao" },
        { typeof(ConviteValidacaoInput), "ConviteValidacaoInput" },
        { typeof(LoginInput), "LoginInput" },
        { typeof(TrocaSenhaInput), "TrocaSenhaInput" },
        { typeof(RejeicaoInput), "Rejeicao" },
    };

    [Theory]
    [MemberData(nameof(Schemas))]
    public void Dto_tem_exatamente_as_propriedades_do_schema(Type dto, string schema)
    {
        var s = Documento.Value.Components.Schemas[schema];
        var contrato = Propriedades(s);
        var csharp = dto.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => p.Name != "EqualityContract")
            .Select(p => JsonNamingPolicy.CamelCase.ConvertName(p.Name))
            .ToHashSet();
        Assert.Equal(contrato.OrderBy(x => x), csharp.OrderBy(x => x));
        Assert.Subset(csharp, Obrigatorias(s));
    }
}
