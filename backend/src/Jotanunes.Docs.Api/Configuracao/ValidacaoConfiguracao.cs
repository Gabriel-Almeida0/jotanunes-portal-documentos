using System.Text;
using Jotanunes.Docs.Application.Portas;

namespace Jotanunes.Docs.Api.Configuracao;

/// <summary>
/// Valida a configuração no startup: segredos Fluig e Portal com ≥ 32 bytes e diferentes entre si; com o login próprio
/// ligado (padrão), <c>Auth:LoginLocal:Secret</c> com ≥ 32 bytes e diferente dos outros dois, e <c>FluigApp:BaseUrl</c>
/// fora de Development; <c>Auth:Fluig:Issuer</c> nunca igual ao emissor do login próprio; fora de Development exige
/// Resend:ApiKey e Resend:From. Nunca inclui valores de segredos na mensagem.
/// </summary>
public static class ValidacaoConfiguracao
{
    public const int TamanhoMinimoSegredo = 32;

    public static IReadOnlyList<string> Validar(IConfiguration cfg, IHostEnvironment env)
    {
        var erros = new List<string>();
        var fluig = cfg["Auth:Fluig:Secret"];
        var portal = cfg["Auth:Portal:Secret"];
        if (Bytes(fluig) < TamanhoMinimoSegredo) erros.Add("Auth:Fluig:Secret ausente ou com menos de 32 bytes.");
        if (Bytes(portal) < TamanhoMinimoSegredo) erros.Add("Auth:Portal:Secret ausente ou com menos de 32 bytes.");
        if (!string.IsNullOrEmpty(fluig) && fluig == portal) erros.Add("Auth:Fluig:Secret e Auth:Portal:Secret devem ser diferentes.");
        // O seletor da área Jotanunes escolhe o esquema pelo emissor: o Fluig não pode usar o emissor do login próprio.
        if (string.Equals((cfg["Auth:Fluig:Issuer"] ?? "fluig").Trim(), OpcoesLoginLocal.Emissor, StringComparison.OrdinalIgnoreCase))
        {
            erros.Add($"Auth:Fluig:Issuer não pode ser \"{OpcoesLoginLocal.Emissor}\" (emissor reservado ao login próprio).");
        }
        if (cfg.GetValue("Auth:LoginLocal:Habilitado", true))
        {
            var local = cfg["Auth:LoginLocal:Secret"];
            if (Bytes(local) < TamanhoMinimoSegredo) erros.Add("Auth:LoginLocal:Secret ausente ou com menos de 32 bytes (login próprio ligado).");
            if (!string.IsNullOrEmpty(local) && local == fluig) erros.Add("Auth:LoginLocal:Secret e Auth:Fluig:Secret devem ser diferentes.");
            if (!string.IsNullOrEmpty(local) && local == portal) erros.Add("Auth:LoginLocal:Secret e Auth:Portal:Secret devem ser diferentes.");
            if (!env.IsDevelopment() && string.IsNullOrWhiteSpace(cfg["FluigApp:BaseUrl"]))
            {
                erros.Add("FluigApp:BaseUrl (endereço da área Jotanunes nos e-mails de acesso) é obrigatório fora de Development.");
            }
        }
        if (string.IsNullOrWhiteSpace(cfg.GetConnectionString("Default"))) erros.Add("ConnectionStrings:Default não configurada.");
        if (!env.IsDevelopment())
        {
            if (string.IsNullOrWhiteSpace(cfg["Resend:ApiKey"])) erros.Add("Resend:ApiKey é obrigatória fora de Development.");
            if (string.IsNullOrWhiteSpace(cfg["Resend:From"])) erros.Add("Resend:From é obrigatório fora de Development.");
        }
        return erros;
    }

    public static void GarantirValida(IConfiguration cfg, IHostEnvironment env)
    {
        var erros = Validar(cfg, env);
        if (erros.Count > 0) throw new InvalidOperationException("Configuração inválida: " + string.Join(" ", erros));
    }

    private static int Bytes(string? s) => string.IsNullOrEmpty(s) ? 0 : Encoding.UTF8.GetByteCount(s);
}
