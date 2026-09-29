using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using Jotanunes.Docs.Application.Erros;

namespace Jotanunes.Docs.Api.Infra;

/// <summary>Corpo application/problem+json (RFC 9457) com as extensões do contrato.</summary>
public sealed record Problema(
    string Type,
    string Title,
    int Status,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Detail,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Instance,
    CodigoErro Code,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyDictionary<string, string[]>? Errors,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DateTimeOffset? BloqueadoAte,
    string? TraceId);

public static class Problemas
{
    public const string ContentType = "application/problem+json";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static Problema Criar(HttpContext ctx, CodigoErro codigo, int? status = null, string? detalhe = null,
        IReadOnlyDictionary<string, string[]>? erros = null, DateTimeOffset? bloqueadoAte = null)
    {
        var (statusPadrao, titulo) = CatalogoErros.Obter(codigo);
        var slug = codigo.ToString().ToLowerInvariant().Replace('_', '-');
        return new Problema($"https://jotanunes.com/problemas/{slug}", titulo, status ?? statusPadrao, detalhe, ctx.Request.Path,
            codigo, erros, bloqueadoAte, Activity.Current?.Id ?? ctx.TraceIdentifier);
    }

    public static Task EscreverAsync(HttpContext ctx, CodigoErro codigo, int? status = null, string? detalhe = null,
        IReadOnlyDictionary<string, string[]>? erros = null, DateTimeOffset? bloqueadoAte = null)
    {
        var p = Criar(ctx, codigo, status, detalhe, erros, bloqueadoAte);
        ctx.Response.StatusCode = p.Status;
        ctx.Response.ContentType = ContentType;
        return ctx.Response.WriteAsync(JsonSerializer.Serialize(p, Json));
    }

    public static Task EscreverAsync(HttpContext ctx, ErroAplicacao erro) =>
        EscreverAsync(ctx, erro.Codigo, erro.Status, erro.Detalhe, erro.ErrosPorCampo, erro.BloqueadoAte);

    public static CodigoErro CodigoPorStatus(int status) => status switch
    {
        401 => CodigoErro.NAO_AUTENTICADO,
        403 => CodigoErro.TROCA_SENHA_OBRIGATORIA,
        404 or 405 => CodigoErro.NAO_ENCONTRADO,
        413 => CodigoErro.ARQUIVO_MUITO_GRANDE,
        415 => CodigoErro.ARQUIVO_TIPO_NAO_SUPORTADO,
        429 => CodigoErro.LIMITE_REQUISICOES,
        >= 500 => CodigoErro.ERRO_INTERNO,
        _ => CodigoErro.VALIDACAO,
    };
}
