using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Jotanunes.Docs.Api.Tests.Infra;

/// <summary>Gera JWTs HS256 manualmente (mesma forma do scripts/gerar-token-fluig-dev.mjs).</summary>
public static class Tokens
{
    /// <summary>
    /// Token Fluig de ADMINISTRADOR (<c>"roles": ["admin"]</c>): os testes de escrita existentes continuam como
    /// administrador sem precisar mudar. Para outro perfil use a sobrecarga com <c>roles</c> ou <see cref="FluigComum"/>.
    /// </summary>
    public static string Fluig(ApiFactory api, string login = "maria.silva", string nome = "Maria Silva", string? email = "maria@jotanunes.com",
        TimeSpan? validade = null, TimeSpan? emitidoHa = null, string? segredo = null, string iss = "fluig", string aud = "jotanunes-docs-api",
        bool incluirIat = true) =>
        CriarFluig(api, login, nome, email, validade, emitidoHa, segredo, iss, aud, incluirIat, new[] { PapelAdmin });

    /// <param name="roles">
    /// Valor bruto da claim <c>roles</c>: <c>null</c> omite a claim (usuário comum); qualquer outro valor
    /// (<c>new[] { "admin" }</c>, <c>"admin"</c>, <c>new[] { "Admin" }</c>, <c>true</c>, <c>1</c>, objeto) é serializado como está.
    /// </param>
    public static string Fluig(ApiFactory api, string login, string nome, string? email, object? roles) =>
        CriarFluig(api, login, nome, email, null, null, null, "fluig", "jotanunes-docs-api", true, roles);

    public const string PapelAdmin = "admin";

    private static string CriarFluig(ApiFactory api, string login, string nome, string? email, TimeSpan? validade, TimeSpan? emitidoHa,
        string? segredo, string iss, string aud, bool incluirIat, object? roles)
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
        if (roles is not null) payload["roles"] = roles;
        return Assinar(payload, segredo ?? ApiFactory.SegredoFluig);
    }

    /// <summary>Token Fluig de usuário comum (sem a claim <c>roles</c>).</summary>
    public static string FluigComum(ApiFactory api, string login = "joao.comum", string nome = "João Comum") =>
        Fluig(api, login, nome, $"{login}@jotanunes.com", roles: null);

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

    // ── Login próprio da área Jotanunes (research R17) ──

    public const string EmissorLocal = "jotanunes-docs";

    /// <summary>Payload válido do token local para o usuário (versão, papel e troca pendente do cadastro).</summary>
    public static Dictionary<string, object?> PayloadLocal(ApiFactory api, Domain.UsuariosInternos.UsuarioInterno u,
        TimeSpan? validade = null, TimeSpan? emitidoHa = null)
    {
        var iat = api.Relogio.GetUtcNow() - (emitidoHa ?? TimeSpan.Zero);
        var exp = iat + (validade ?? TimeSpan.FromHours(8));
        var payload = new Dictionary<string, object?>
        {
            ["iss"] = EmissorLocal,
            ["aud"] = "jotanunes-docs-api",
            ["sub"] = u.Login,
            ["name"] = u.Nome,
            ["email"] = u.Email,
            ["uid"] = u.Id.ToString(),
            ["ver"] = u.VersaoCredencial,
            ["troca_senha"] = u.TrocaSenhaObrigatoria,
            ["iat"] = iat.ToUnixTimeSeconds(),
            ["nbf"] = iat.ToUnixTimeSeconds(),
            ["exp"] = exp.ToUnixTimeSeconds(),
        };
        if (u.Admin) payload["roles"] = new[] { PapelAdmin };
        return payload;
    }

    /// <summary>Token local válido, igual ao que a API emite no login (use o usuário recarregado do banco).</summary>
    public static string Local(ApiFactory api, Domain.UsuariosInternos.UsuarioInterno u) => Assinar(PayloadLocal(api, u), ApiFactory.SegredoLoginLocal);

    /// <summary>
    /// Token local forjado: parte do payload válido de <paramref name="u"/> e aplica <paramref name="ajustar"/> (trocar ou
    /// remover claims). <paramref name="segredo"/> padrão = segredo do login próprio; <paramref name="algNone"/> = sem assinatura.
    /// </summary>
    public static string LocalBruto(ApiFactory api, Domain.UsuariosInternos.UsuarioInterno u, Action<Dictionary<string, object?>>? ajustar = null,
        string? segredo = null, bool algNone = false, TimeSpan? validade = null, TimeSpan? emitidoHa = null)
    {
        var payload = PayloadLocal(api, u, validade, emitidoHa);
        ajustar?.Invoke(payload);
        return algNone
            ? $"{B64(new { alg = "none", typ = "JWT" })}.{B64(payload)}."
            : Assinar(payload, segredo ?? ApiFactory.SegredoLoginLocal);
    }

    /// <summary>Semeia um usuário interno comum (senha já definida) e devolve o token local dele.</summary>
    public static async Task<string> LocalComumAsync(ApiFactory api, string login = "carla.comum", string nome = "Carla Comum") =>
        Local(api, await new Semente(api).UsuarioInternoAsync(login, nome, admin: false));

    /// <summary>Semeia um usuário interno administrador (senha já definida) e devolve o token local dele.</summary>
    public static async Task<string> LocalAdminAsync(ApiFactory api, string login = "lucas.admin", string nome = "Lucas Admin") =>
        Local(api, await new Semente(api).UsuarioInternoAsync(login, nome, admin: true));

    private static string Assinar(Dictionary<string, object?> payload, string segredo)
    {
        var dados = $"{B64(new { alg = "HS256", typ = "JWT" })}.{B64(payload)}";
        var assinatura = HMACSHA256.HashData(Encoding.UTF8.GetBytes(segredo), Encoding.ASCII.GetBytes(dados));
        return $"{dados}.{B64Url(assinatura)}";
    }

    private static string B64(object obj) => B64Url(JsonSerializer.SerializeToUtf8Bytes(obj));

    private static string B64Url(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
