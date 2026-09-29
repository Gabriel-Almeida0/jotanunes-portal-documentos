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
/// </summary>
public sealed class TentativasLoginRepositorio(DocsDbContext db, IOptions<OpcoesAuthPortal> opcoes) : ITentativasLoginRepositorio
{
    private const string Rotulo = "jotanunes-docs/tentativas-login/v1";

    public async Task<TentativasLoginCnpj> ObterOuCriarAsync(string cnpjNormalizado, CancellationToken ct = default)
    {
        var chave = CalcularChave(cnpjNormalizado);
        var existente = await db.TentativasLogin.FirstOrDefaultAsync(t => t.Chave == chave, ct);
        if (existente is not null) return existente;

        // Duas requisições simultâneas para o mesmo CNPJ novo: a segunda não falha, só reaproveita a linha.
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO tentativas_login (chave, tentativas_falhas) VALUES ({chave}, 0) ON CONFLICT (chave) DO NOTHING", ct);
        return await db.TentativasLogin.FirstAsync(t => t.Chave == chave, ct);
    }

    internal string CalcularChave(string cnpjNormalizado)
    {
        var segredo = SHA256.HashData(Encoding.UTF8.GetBytes(Rotulo + "\n" + opcoes.Value.Secret));
        return Convert.ToHexString(HMACSHA256.HashData(segredo, Encoding.UTF8.GetBytes(cnpjNormalizado))).ToLowerInvariant();
    }
}
