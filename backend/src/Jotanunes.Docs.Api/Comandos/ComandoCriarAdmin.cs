using Jotanunes.Docs.Application.Emails;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Application.UsuariosInternos;
using Jotanunes.Docs.Domain.Comum;
using Microsoft.Extensions.Options;

namespace Jotanunes.Docs.Api.Comandos;

/// <summary>
/// <c>criar-admin --login &lt;login&gt; --nome "&lt;nome&gt;" --email &lt;email&gt; [--forcar]</c> — primeiro administrador interno
/// (research R17, FR-111). Roda com a mesma composição e configuração da API, sem subir o servidor HTTP.
/// Escreve SÓ nos <see cref="TextWriter"/> recebidos (terminal de quem executa) e nunca em <c>ILogger</c>: a senha
/// provisória não pode ir para o journal (constituição III v1.2.0).
/// Códigos de saída: 0 = criado/promovido (mesmo se o e-mail falhar); 1 = uso inválido ou login próprio desligado;
/// 2 = já existe administrador interno ativo (sem <c>--forcar</c>), nada alterado.
/// </summary>
public static class ComandoCriarAdmin
{
    public const string Nome = "criar-admin";
    public const int Sucesso = 0;
    public const int ErroUso = 1;
    public const int JaExisteAdministrador = 2;

    public const string Uso = """
        Uso: criar-admin --login <login> --nome "<nome>" --email <email> [--forcar]

          --login   login do administrador (3 a 100 caracteres: letras sem acento, números, ponto, hífen ou sublinhado)
          --nome    nome completo (3 a 150 caracteres)
          --email   e-mail que recebe a senha provisória
          --forcar  cria ou recupera o administrador mesmo se já existir outro administrador ativo
                    (login existente: vira administrador ativo, com nova senha provisória)

        Códigos de saída: 0 = pronto; 1 = uso inválido ou login próprio desligado; 2 = já existe administrador (nada mudou).
        """;

    /// <summary>O processo foi chamado para o comando (e não para subir a API)?</summary>
    public static bool EhComando(string[] args) => args is [Nome, ..];

    public static async Task<int> ExecutarAsync(IServiceProvider servicos, string[] args, TextWriter saida, TextWriter erro,
        CancellationToken ct = default)
    {
        if (!TentarLerArgumentos(args, out var login, out var nome, out var email, out var forcar, out var problema))
        {
            await erro.WriteLineAsync(problema);
            await erro.WriteLineAsync(Uso);
            return ErroUso;
        }

        if (!servicos.GetRequiredService<IOptions<OpcoesLoginLocal>>().Value.Habilitado)
        {
            await erro.WriteLineAsync("O login próprio da área Jotanunes está desligado (Auth:LoginLocal:Habilitado=false). " +
                "Ligue-o para criar administradores internos.");
            return ErroUso;
        }

        ResultadoCriarAdministrador r;
        await using (var escopo = servicos.CreateAsyncScope())
        {
            try
            {
                r = await escopo.ServiceProvider.GetRequiredService<CriarAdministradorInicial>().ExecutarAsync(login, nome, email, forcar, ct);
            }
            catch (ErroDominio e) when (e.Tipo == TipoErroDominio.Validacao)
            {
                foreach (var (campo, mensagens) in e.Erros) await erro.WriteLineAsync($"--{campo}: {string.Join(" ", mensagens)}");
                await erro.WriteLineAsync(Uso);
                return ErroUso;
            }
        }

        if (r.Situacao == SituacaoCriarAdministrador.JaExisteAdministrador)
        {
            await erro.WriteLineAsync("Já existe administrador interno ativo. Nada foi alterado. " +
                "Para criar ou recuperar um administrador assim mesmo, repita o comando com --forcar.");
            return JaExisteAdministrador;
        }

        await saida.WriteLineAsync(r.Situacao == SituacaoCriarAdministrador.Criado
            ? $"Administrador criado: {r.Login}"
            : $"Administrador {r.Login} ativado com nova senha provisória (as sessões anteriores dele deixaram de valer).");
        await saida.WriteLineAsync($"Senha provisória: {r.SenhaProvisoria}");
        await saida.WriteLineAsync($"Vale até {ModelosEmail.FormatarData(r.SenhaProvisoriaExpiraEm!.Value)} (horário de Brasília); " +
            "no primeiro acesso é obrigatório criar uma nova senha.");
        await saida.WriteLineAsync($"Área Jotanunes: {r.UrlAreaJotanunes}");
        if (r.EmailEnviado)
        {
            await saida.WriteLineAsync($"E-mail de acesso enviado para {r.Email}.");
        }
        else
        {
            await erro.WriteLineAsync($"Aviso: não conseguimos enviar o e-mail de acesso para {r.Email}. " +
                "Passe a senha provisória acima à pessoa por um canal seguro.");
        }
        return Sucesso;
    }

    private static bool TentarLerArgumentos(string[] args, out string? login, out string? nome, out string? email, out bool forcar,
        out string problema)
    {
        login = nome = email = null;
        forcar = false;
        problema = string.Empty;
        if (!EhComando(args))
        {
            problema = "Comando desconhecido.";
            return false;
        }
        for (var i = 1; i < args.Length; i++)
        {
            var arg = args[i];
            var igual = arg.IndexOf('=');
            var chave = igual > 0 ? arg[..igual] : arg;
            string? valor = igual > 0 ? arg[(igual + 1)..] : null;
            if (chave == "--forcar" && valor is null)
            {
                forcar = true;
                continue;
            }
            if (chave is not ("--login" or "--nome" or "--email"))
            {
                problema = $"Argumento desconhecido: {arg}";
                return false;
            }
            if (valor is null)
            {
                if (i + 1 >= args.Length || args[i + 1].StartsWith("--", StringComparison.Ordinal))
                {
                    problema = $"Falta o valor de {chave}.";
                    return false;
                }
                valor = args[++i];
            }
            switch (chave)
            {
                case "--login": login = valor; break;
                case "--nome": nome = valor; break;
                default: email = valor; break;
            }
        }
        var faltando = new[] { ("--login", login), ("--nome", nome), ("--email", email) }
            .Where(x => string.IsNullOrWhiteSpace(x.Item2)).Select(x => x.Item1).ToList();
        if (faltando.Count > 0)
        {
            problema = $"Informe {string.Join(", ", faltando)}.";
            return false;
        }
        return true;
    }
}
