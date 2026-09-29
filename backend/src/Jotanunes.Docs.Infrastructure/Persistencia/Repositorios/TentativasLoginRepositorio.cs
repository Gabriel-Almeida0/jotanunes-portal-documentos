using System.Security.Cryptography;
using System.Text;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Infrastructure.Seguranca;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Jotanunes.Docs.Infrastructure.Persistencia.Repositorios;

/// <summary>
/// Contadores de falha de login por CNPJ sem empresa com senha. A chave é HMAC-SHA256 do CNPJ normalizado
/// com uma chave derivada de <c>Auth:Portal:Secret</c>: o CNPJ digitado nunca é gravado, e o espaço pequeno
/// de CNPJs não permite reverter a chave sem o segredo (um SHA-256 puro seria revertido por força bruta).
/// Trocar o segredo apenas zera esses contadores (o bloqueio dura 15 min).
/// Logins do login próprio (research R17) usam a mesma tabela com chave HMAC de <c>"usuario:" + login</c>, derivada de
/// <c>Auth:LoginLocal:Secret</c> com rótulo próprio: as chaves não colidem com as de CNPJ e o login digitado não é gravado.
/// </summary>
public sealed class TentativasLoginRepositorio(DocsDbContext db, IOptions<OpcoesAuthPortal> opcoes, IOptions<OpcoesLoginLocal> loginLocal)
    : ITentativasLoginRepositorio
{
    private const string Rotulo = "jotanunes-docs/tentativas-login/v1";
    private const string RotuloLoginLocal = "jotanunes-docs/tentativas-login-local/v1";

    public Task<TentativasLoginCnpj> ObterOuCriarAsync(string cnpjNormalizado, CancellationToken ct = default) =>
        ObterOuCriarPorChaveAsync(CalcularChave(cnpjNormalizado), ct);

    public Task<TentativasLoginCnpj> ObterOuCriarPorLoginLocalAsync(string loginNormalizado, CancellationToken ct = default) =>
        ObterOuCriarPorChaveAsync(CalcularChaveLoginLocal(loginNormalizado), ct);

    private async Task<TentativasLoginCnpj> ObterOuCriarPorChaveAsync(string chave, CancellationToken ct)
    {
        var existente = await db.TentativasLogin.FirstOrDefaultAsync(t => t.Chave == chave, ct);
        if (existente is not null) return existente;

        // Duas requisições simultâneas para o mesmo CNPJ novo: a segunda não falha, só reaproveita a linha.
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO tentativas_login (chave, tentativas_falhas) VALUES ({chave}, 0) ON CONFLICT (chave) DO NOTHING", ct);
        return await db.TentativasLogin.FirstAsync(t => t.Chave == chave, ct);
    }

    internal string CalcularChave(string cnpjNormalizado) => Hmac(Rotulo, opcoes.Value.Secret, cnpjNormalizado);

    internal string CalcularChaveLoginLocal(string loginNormalizado) => Hmac(RotuloLoginLocal, loginLocal.Value.Secret, "usuario:" + loginNormalizado);

    private static string Hmac(string rotulo, string segredoConfigurado, string valor)
    {
        var segredo = SHA256.HashData(Encoding.UTF8.GetBytes(rotulo + "\n" + segredoConfigurado));
        return Convert.ToHexString(HMACSHA256.HashData(segredo, Encoding.UTF8.GetBytes(valor))).ToLowerInvariant();
    }
}
