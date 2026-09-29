using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Jotanunes.Docs.Api.Tests.Infra;

/// <summary>Gera JWTs HS256 manualmente (mesma forma do scripts/gerar-token-fluig-dev.mjs).</summary>
public static class Tokens
{
    public static string Fluig(ApiFactory api, string login = "maria.silva", string nome = "Maria Silva", string? email = "maria@jotanunes.com",
        TimeSpan? validade = null, TimeSpan? emitidoHa = null, string? segredo = null, string iss = "fluig", string aud = "jotanunes-docs-api",
        bool incluirIat = true)
    {
        var iat = api.Relogio.GetUtcNow() - (emitidoHa ?? TimeSpan.Zero);
        var exp = iat + (validade ?? TimeSpan.FromHours(8));
        var payload = new Dictionary<string, object?>
        {
            ["iss"] = iss,
            ["aud"] = aud,
            ["sub"] = login,
            ["name"] = nome,
            ["exp"] = exp.ToUnixTimeSeconds(),
        };
        if (email is not null) payload["email"] = email;
        if (incluirIat) payload["iat"] = iat.ToUnixTimeSeconds();
        return Assinar(payload, segredo ?? ApiFactory.SegredoFluig);
    }

    public static string Portal(ApiFactory api, Guid empresaId, string cnpj, int versao, bool trocaSenha, string? segredo = null,
        TimeSpan? validade = null, TimeSpan? emitidoHa = null)
    {
        var iat = api.Relogio.GetUtcNow() - (emitidoHa ?? TimeSpan.Zero);
        var exp = iat + (validade ?? TimeSpan.FromHours(8));
        return Assinar(new Dictionary<string, object?>
        {
            ["iss"] = "jotanunes-docs-portal",
            ["aud"] = "jotanunes-docs-portal",
            ["sub"] = empresaId.ToString(),
            ["cnpj"] = cnpj,
            ["ver"] = versao,
            ["troca_senha"] = trocaSenha,
            ["iat"] = iat.ToUnixTimeSeconds(),
            ["nbf"] = iat.ToUnixTimeSeconds(),
            ["exp"] = exp.ToUnixTimeSeconds(),
        }, segredo ?? ApiFactory.SegredoPortal);
    }

    /// <summary>Token sem assinatura (alg=none) com payload Fluig válido.</summary>
    public static string AlgNone(ApiFactory api)
    {
        var iat = api.Relogio.GetUtcNow();
        var payload = new Dictionary<string, object?>
        {
            ["iss"] = "fluig", ["aud"] = "jotanunes-docs-api", ["sub"] = "invasor", ["name"] = "Invasor",
            ["iat"] = iat.ToUnixTimeSeconds(), ["exp"] = (iat + TimeSpan.FromHours(1)).ToUnixTimeSeconds(),
        };
        return $"{B64(new { alg = "none", typ = "JWT" })}.{B64(payload)}.";
    }

    private static string Assinar(Dictionary<string, object?> payload, string segredo)
    {
        var dados = $"{B64(new { alg = "HS256", typ = "JWT" })}.{B64(payload)}";
        var assinatura = HMACSHA256.HashData(Encoding.UTF8.GetBytes(segredo), Encoding.ASCII.GetBytes(dados));
        return $"{dados}.{B64Url(assinatura)}";
    }

    private static string B64(object obj) => B64Url(JsonSerializer.SerializeToUtf8Bytes(obj));

    private static string B64Url(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
