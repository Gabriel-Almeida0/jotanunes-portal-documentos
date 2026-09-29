using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Emails;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.UsuariosInternos;
using Microsoft.Extensions.Options;

namespace Jotanunes.Docs.Application.UsuariosInternos;

public enum SituacaoCriarAdministrador
{
    /// <summary>Login novo: administrador criado.</summary>
    Criado,
    /// <summary>Login existente: virou administrador ativo com nova senha provisória.</summary>
    Promovido,
    /// <summary>Já existe administrador interno ativo e não foi pedido <c>--forcar</c>: nada mudou.</summary>
    JaExisteAdministrador,
}

/// <summary>
/// Resultado do comando. A senha provisória só existe aqui para ser mostrada no terminal de quem executou o comando
/// (constituição III v1.2.0) — nunca é registrada em log.
/// </summary>
public sealed record ResultadoCriarAdministrador(
    SituacaoCriarAdministrador Situacao,
    string? Login = null,
    string? Email = null,
    string? SenhaProvisoria = null,
    DateTimeOffset? SenhaProvisoriaExpiraEm = null,
    string? UrlAreaJotanunes = null,
    bool EmailEnviado = false);

/// <summary>
/// Primeiro administrador (comando <c>criar-admin</c>, research R17). Sob o bloqueio exclusivo dos usuários internos:
/// com administrador interno ativo e sem <paramref name="forcar"/> → recusa sem alterar nada; senão cria o login novo ou
/// promove/reativa/redefine o existente. Autoria <c>sistema</c>, auditoria SISTEMA. Ordem: confirma → envia o e-mail
/// (falha do e-mail não desfaz: a senha já está no terminal).
/// </summary>
public sealed class CriarAdministradorInicial(
    IUsuarioInternoRepositorio usuarios,
    IUnidadeTrabalho uow,
    IBloqueioExclusivo bloqueio,
    IGeradorSegredos segredos,
    IHasherSenha hasher,
    IEnviadorEmail email,
    IRegistroAuditoria auditoria,
    IOptions<ConfiguracaoAreaJotanunes> areaJotanunes,
    TimeProvider relogio) : ICasoDeUso
{
    public const string Autor = "sistema";

    /// <exception cref="Domain.Comum.ErroDominio">login, nome ou e-mail inválidos.</exception>
    public async Task<ResultadoCriarAdministrador> ExecutarAsync(string? login, string? nome, string? emailUsuario, bool forcar,
        CancellationToken ct = default)
    {
        var agora = relogio.GetUtcNow();
        var senha = segredos.GerarSenhaTemporaria();
        var hash = hasher.Gerar(senha);
        // Valida os três campos antes de tocar no banco.
        var novo = UsuarioInterno.Criar(login, nome, emailUsuario, admin: true, hash, Autor, agora);

        UsuarioInterno alvo;
        SituacaoCriarAdministrador situacao;
        await using (var transacao = await uow.IniciarTransacaoAsync(ct))
        {
            await bloqueio.AdquirirAsync(BloqueioUsuariosInternos.Chave, ct);
            if (!forcar && await usuarios.ContarAdministradoresAtivosAsync(ct) > 0)
            {
                return new ResultadoCriarAdministrador(SituacaoCriarAdministrador.JaExisteAdministrador);
            }

            var existente = await usuarios.ObterPorLoginAsync(novo.Login, ct);
            if (existente is null)
            {
                usuarios.Adicionar(novo);
                auditoria.Registrar(AtorAuditoria.Sistema, Autor, AcaoAuditoria.UsuarioCriado, RecursoAuditoria.UsuarioInterno, novo.Id.ToString());
                (alvo, situacao) = (novo, SituacaoCriarAdministrador.Criado);
            }
            else
            {
                existente.PromoverAdministradorInicial(nome, emailUsuario, hash, Autor, agora);
                auditoria.Registrar(AtorAuditoria.Sistema, Autor, AcaoAuditoria.SenhaRedefinida, RecursoAuditoria.UsuarioInterno, existente.Id.ToString());
                (alvo, situacao) = (existente, SituacaoCriarAdministrador.Promovido);
            }
            await uow.SalvarAsync(ct);
            await transacao.ConfirmarAsync(ct);
        }

        var url = areaJotanunes.Value.BaseUrl.TrimEnd('/');
        var expira = alvo.SenhaProvisoriaExpiraEm!.Value;
        var enviado = true;
        try
        {
            await email.EnviarAsync(ModelosEmail.AcessoUsuarioInterno(alvo.Email, alvo.Nome, alvo.Login, senha, url, expira,
                redefinicao: situacao == SituacaoCriarAdministrador.Promovido), ct);
        }
        catch (FalhaEnvioEmail)
        {
            enviado = false;
        }
        return new ResultadoCriarAdministrador(situacao, alvo.Login, alvo.Email, senha, expira, url, enviado);
    }
}
