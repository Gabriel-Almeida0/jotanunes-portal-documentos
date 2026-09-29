using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Empresas;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Jotanunes.Docs.Infrastructure.Seguranca;

public sealed class BCryptHasherSenha : IHasherSenha
{
    public const int Custo = 12;
    private static readonly Lazy<string> HashFicticio = new(() => BCrypt.Net.BCrypt.HashPassword("senha-ficticia-para-tempo-constante", Custo));

    public string Gerar(string senha) => BCrypt.Net.BCrypt.HashPassword(senha, Custo);

    public bool Verificar(string senha, string hash)
    {
        try { return BCrypt.Net.BCrypt.Verify(senha, hash); }
        catch (BCrypt.Net.SaltParseException) { return false; }
    }

    public void VerificarFicticio(string senha) => _ = BCrypt.Net.BCrypt.Verify(senha, HashFicticio.Value);
}

public sealed class GeradorSegredos : IGeradorSegredos
{
    // Alfabeto sem caracteres ambíguos (research R3).
    private const string Alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

    public (string Token, string Hash) GerarTokenConvite()
    {
        var token = Base64Url(RandomNumberGenerator.GetBytes(32));
        return (token, CalcularHashToken(token));
    }

    public string CalcularHashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    public string GerarSenhaTemporaria()
    {
        while (true)
        {
            var senha = new string(RandomNumberGenerator.GetItems<char>(Alfabeto, 12));
            if (senha.Any(char.IsLetter) && senha.Any(char.IsDigit)) return senha;
        }
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

/// <summary>Configuração do token do portal (seção Auth:Portal).</summary>
public sealed class OpcoesAuthPortal
{
    public const string Emissor = "jotanunes-docs-portal";
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = Emissor;
    public string Audience { get; set; } = Emissor;
    public int ValidadeHoras { get; set; } = 8;

    public SymmetricSecurityKey Chave() => new(Encoding.UTF8.GetBytes(Secret));
}

public static class ClaimsPortal
{
    public const string Sub = "sub";
    public const string Cnpj = "cnpj";
    public const string Versao = "ver";
    public const string TrocaSenha = "troca_senha";
}

public sealed class EmissorTokenPortal(IOptions<OpcoesAuthPortal> opcoes, TimeProvider relogio) : IEmissorTokenPortal
{
    public TokenPortal Emitir(Empresa empresa)
    {
        var o = opcoes.Value;
        var agora = relogio.GetUtcNow();
        var expira = agora.AddHours(o.ValidadeHoras);
        var descritor = new SecurityTokenDescriptor
        {
            Issuer = o.Issuer,
            Audience = o.Audience,
            IssuedAt = agora.UtcDateTime,
            NotBefore = agora.UtcDateTime,
            Expires = expira.UtcDateTime,
            Claims = new Dictionary<string, object>
            {
                [ClaimsPortal.Sub] = empresa.Id.ToString(),
                [ClaimsPortal.Cnpj] = empresa.Cnpj,
                [ClaimsPortal.Versao] = empresa.VersaoCredencial,
                [ClaimsPortal.TrocaSenha] = empresa.TrocaSenhaObrigatoria,
            },
            SigningCredentials = new SigningCredentials(o.Chave(), SecurityAlgorithms.HmacSha256),
        };
        var token = new JsonWebTokenHandler { SetDefaultTimesOnTokenCreation = false }.CreateToken(descritor);
        return new TokenPortal(token, expira);
    }
}

/// <summary>Claims do token do login próprio que não existem no token do Fluig (research R17).</summary>
public static class ClaimsLoginLocal
{
    public const string Sub = "sub";
    public const string Nome = "name";
    public const string Email = "email";
    public const string Papeis = "roles";
    public const string UsuarioId = "uid";
    public const string Versao = "ver";
    public const string TrocaSenha = "troca_senha";
    public const string PapelAdmin = "admin";

    /// <summary>Chave HS256 do segredo configurado (segredo vazio — login desligado — vira uma chave aleatória inútil).</summary>
    public static SymmetricSecurityKey Chave(string segredo) =>
        new(string.IsNullOrEmpty(segredo) ? RandomNumberGenerator.GetBytes(32) : Encoding.UTF8.GetBytes(segredo));
}

/// <summary>
/// Token do login próprio da área Jotanunes: HS256 com <c>Auth:LoginLocal:Secret</c>, <c>iss = jotanunes-docs</c>,
/// <c>aud = jotanunes-docs-api</c>, 8 h; mesmas claims <c>sub</c>/<c>name</c>/<c>email</c>/<c>roles</c> do Fluig
/// (<c>roles</c> omitida para usuário comum) e mais <c>uid</c>, <c>ver</c> e <c>troca_senha</c>.
/// </summary>
public sealed class EmissorTokenJotanunes(IOptions<OpcoesLoginLocal> opcoes, TimeProvider relogio) : IEmissorTokenJotanunes
{
    public TokenJotanunes Emitir(Domain.UsuariosInternos.UsuarioInterno usuario)
    {
        var agora = relogio.GetUtcNow();
        var expira = agora + OpcoesLoginLocal.Validade;
        var claims = new Dictionary<string, object>
        {
            [ClaimsLoginLocal.Sub] = usuario.Login,
            [ClaimsLoginLocal.Nome] = usuario.Nome,
            [ClaimsLoginLocal.Email] = usuario.Email,
            [ClaimsLoginLocal.UsuarioId] = usuario.Id.ToString(),
            [ClaimsLoginLocal.Versao] = usuario.VersaoCredencial,
            [ClaimsLoginLocal.TrocaSenha] = usuario.TrocaSenhaObrigatoria,
        };
        if (usuario.Admin) claims[ClaimsLoginLocal.Papeis] = new[] { ClaimsLoginLocal.PapelAdmin };
        var descritor = new SecurityTokenDescriptor
        {
            Issuer = OpcoesLoginLocal.Emissor,
            Audience = OpcoesLoginLocal.Audiencia,
            IssuedAt = agora.UtcDateTime,
            NotBefore = agora.UtcDateTime,
            Expires = expira.UtcDateTime,
            Claims = claims,
            SigningCredentials = new SigningCredentials(ClaimsLoginLocal.Chave(opcoes.Value.Secret), SecurityAlgorithms.HmacSha256),
        };
        var token = new JsonWebTokenHandler { SetDefaultTimesOnTokenCreation = false }.CreateToken(descritor);
        return new TokenJotanunes(token, expira);
    }
}
