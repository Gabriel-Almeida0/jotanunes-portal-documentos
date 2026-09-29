using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Emails;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.UsuariosInternos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Jotanunes.Docs.Application.UsuariosInternos;

/// <summary>
/// Chave do bloqueio exclusivo (<c>pg_advisory_xact_lock</c>) que serializa tudo que muda o conjunto de
/// administradores internos: atualização pela tela e comando <c>criar-admin</c> (research R17). "JNUSUAR" em ASCII.
/// </summary>
public static class BloqueioUsuariosInternos
{
    public const long Chave = 0x4A4E5553554152;
}

public sealed class ListarUsuariosInternos(IUsuarioInternoRepositorio usuarios, TimeProvider relogio) : ICasoDeUso
{
    public async Task<PaginaResultado<UsuarioInternoDto>> ExecutarAsync(string? busca, bool? ativo, bool? admin, int? pagina, int? tamanhoPagina,
        CancellationToken ct = default)
    {
        var paginacao = Paginacao.Criar(pagina, tamanhoPagina);
        var r = await usuarios.ListarAsync(new FiltroUsuariosInternos(Entrada.Busca(busca), ativo, admin), paginacao, ct);
        var agora = relogio.GetUtcNow();
        return new PaginaResultado<UsuarioInternoDto>(r.Itens.Select(u => UsuarioInternoDto.De(u, agora)).ToList(), r.Total, r.Pagina, r.TamanhoPagina);
    }
}

public sealed class ObterUsuarioInterno(IUsuarioInternoRepositorio usuarios, TimeProvider relogio) : ICasoDeUso
{
    public async Task<UsuarioInternoDto> ExecutarAsync(Guid id, CancellationToken ct = default) =>
        UsuarioInternoDto.De(await usuarios.ObterAsync(id, ct) ?? throw ErroAplicacao.NaoEncontrado(), relogio.GetUtcNow());
}

/// <summary>
/// Cadastra o usuário com senha provisória (12 caracteres, 7 dias) e envia o e-mail de acesso. Ordem: grava → e-mail →
/// confirma; e-mail falhando desfaz tudo (502 EMAIL_ACESSO_FALHOU). A senha nunca volta na resposta nem vai para o log.
/// </summary>
public sealed class CriarUsuarioInterno(
    IUsuarioInternoRepositorio usuarios,
    IUnidadeTrabalho uow,
    IUsuarioFluigAtual autor,
    IGeradorSegredos segredos,
    IHasherSenha hasher,
    IEnviadorEmail email,
    IRegistroAuditoria auditoria,
    IOptions<ConfiguracaoAreaJotanunes> areaJotanunes,
    TimeProvider relogio,
    ILogger<CriarUsuarioInterno> log) : ICasoDeUso
{
    public async Task<UsuarioInternoDto> ExecutarAsync(UsuarioInternoInput entrada, CancellationToken ct = default)
    {
        var agora = relogio.GetUtcNow();
        var senha = segredos.GerarSenhaTemporaria();
        var usuario = UsuarioInterno.Criar(entrada.Login, entrada.Nome, entrada.Email, entrada.Admin ?? false, hasher.Gerar(senha), autor.Login, agora);
        if (await usuarios.ObterPorLoginAsync(usuario.Login, ct) is not null) throw new ErroAplicacao(CodigoErro.LOGIN_DUPLICADO);

        usuarios.Adicionar(usuario);
        auditoria.Registrar(AtorAuditoria.Fluig, autor.Login, AcaoAuditoria.UsuarioCriado, RecursoAuditoria.UsuarioInterno, usuario.Id.ToString());
        var mensagem = ModelosEmail.AcessoUsuarioInterno(usuario.Email, usuario.Nome, usuario.Login, senha, areaJotanunes.Value.BaseUrl,
            usuario.SenhaProvisoriaExpiraEm!.Value, redefinicao: false);
        await EmailAcesso.GravarEnviarConfirmarAsync(uow, email, mensagem, log, usuario.Id, ct);
        return UsuarioInternoDto.De(usuario, agora);
    }
}

/// <summary>
/// Nova senha provisória para um usuário ativo (desativado → 409 USUARIO_INATIVO): troca obrigatória, +7 dias, zera o
/// bloqueio e revoga as sessões. Mesma ordem do cadastro (e-mail falhando → nada muda).
/// </summary>
public sealed class RedefinirSenhaUsuarioInterno(
    IUsuarioInternoRepositorio usuarios,
    IUnidadeTrabalho uow,
    IUsuarioFluigAtual autor,
    IGeradorSegredos segredos,
    IHasherSenha hasher,
    IEnviadorEmail email,
    IRegistroAuditoria auditoria,
    IOptions<ConfiguracaoAreaJotanunes> areaJotanunes,
    TimeProvider relogio,
    ILogger<RedefinirSenhaUsuarioInterno> log) : ICasoDeUso
{
    public async Task<UsuarioInternoDto> ExecutarAsync(Guid id, CancellationToken ct = default)
    {
        var usuario = await usuarios.ObterAsync(id, ct) ?? throw ErroAplicacao.NaoEncontrado();
        if (!usuario.Ativo) throw new ErroAplicacao(CodigoErro.USUARIO_INATIVO);

        var agora = relogio.GetUtcNow();
        var senha = segredos.GerarSenhaTemporaria();
        usuario.RedefinirSenha(hasher.Gerar(senha), autor.Login, agora);
        auditoria.Registrar(AtorAuditoria.Fluig, autor.Login, AcaoAuditoria.SenhaRedefinida, RecursoAuditoria.UsuarioInterno, usuario.Id.ToString());
        var mensagem = ModelosEmail.AcessoUsuarioInterno(usuario.Email, usuario.Nome, usuario.Login, senha, areaJotanunes.Value.BaseUrl,
            usuario.SenhaProvisoriaExpiraEm!.Value, redefinicao: true);
        await EmailAcesso.GravarEnviarConfirmarAsync(uow, email, mensagem, log, usuario.Id, ct);
        return UsuarioInternoDto.De(usuario, agora);
    }
}

/// <summary>
/// Atualiza nome, e-mail, papel e ativação (o login não muda). Sob o bloqueio exclusivo dos usuários internos:
/// (1) sessão de login próprio desativando a si mesma ou tirando o próprio papel → ALTERACAO_PROPRIA_NAO_PERMITIDA;
/// (2) o resultado deixaria zero administradores internos ativos → ULTIMO_ADMINISTRADOR (FR-110).
/// </summary>
public sealed class AtualizarUsuarioInterno(
    IUsuarioInternoRepositorio usuarios,
    IUnidadeTrabalho uow,
    IBloqueioExclusivo bloqueio,
    IUsuarioFluigAtual autor,
    IRegistroAuditoria auditoria,
    TimeProvider relogio) : ICasoDeUso
{
    public async Task<UsuarioInternoDto> ExecutarAsync(Guid id, UsuarioInternoAtualizacao entrada, CancellationToken ct = default)
    {
        var erros = new Dictionary<string, string[]>();
        if (entrada.Admin is null) erros["admin"] = ["Informe se é administrador."];
        if (entrada.Ativo is null) erros["ativo"] = ["Informe se está ativo."];
        if (erros.Count > 0) throw new ErroAplicacao(CodigoErro.VALIDACAO, null, erros);
        var admin = entrada.Admin!.Value;
        var ativo = entrada.Ativo!.Value;

        await using var transacao = await uow.IniciarTransacaoAsync(ct);
        await bloqueio.AdquirirAsync(BloqueioUsuariosInternos.Chave, ct);
        var usuario = await usuarios.ObterAsync(id, ct) ?? throw ErroAplicacao.NaoEncontrado();

        if (autor.EhLoginLocal && autor.UsuarioInternoId == usuario.Id && (!ativo || !admin))
        {
            throw new ErroAplicacao(CodigoErro.ALTERACAO_PROPRIA_NAO_PERMITIDA);
        }
        if (usuario.EhAdministradorAtivo && !(admin && ativo) && await usuarios.ContarAdministradoresAtivosAsync(ct) <= 1)
        {
            throw new ErroAplicacao(CodigoErro.ULTIMO_ADMINISTRADOR);
        }

        var agora = relogio.GetUtcNow();
        var (nomeAntes, emailAntes, adminAntes, ativoAntes) = (usuario.Nome, usuario.Email, usuario.Admin, usuario.Ativo);
        usuario.AtualizarDados(entrada.Nome, entrada.Email, autor.Login, agora);
        usuario.DefinirAdmin(admin, autor.Login, agora);
        if (ativo) usuario.Reativar(autor.Login, agora);
        else usuario.Desativar(autor.Login, agora);

        var recurso = usuario.Id.ToString();
        if (usuario.Nome != nomeAntes || usuario.Email != emailAntes || usuario.Admin != adminAntes)
        {
            auditoria.Registrar(AtorAuditoria.Fluig, autor.Login, AcaoAuditoria.UsuarioAtualizado, RecursoAuditoria.UsuarioInterno, recurso);
        }
        if (usuario.Ativo != ativoAntes)
        {
            auditoria.Registrar(AtorAuditoria.Fluig, autor.Login, ativo ? AcaoAuditoria.UsuarioReativado : AcaoAuditoria.UsuarioDesativado,
                RecursoAuditoria.UsuarioInterno, recurso);
        }
        await uow.SalvarAsync(ct);
        await transacao.ConfirmarAsync(ct);
        return UsuarioInternoDto.De(usuario, agora);
    }
}

internal static class EmailAcesso
{
    /// <summary>Grava → envia → confirma. Falha no e-mail desfaz a gravação (502 EMAIL_ACESSO_FALHOU).</summary>
    public static async Task GravarEnviarConfirmarAsync(IUnidadeTrabalho uow, IEnviadorEmail email, MensagemEmail mensagem, ILogger log,
        Guid usuarioId, CancellationToken ct)
    {
        await using var tx = await uow.IniciarTransacaoAsync(ct);
        await uow.SalvarAsync(ct);
        try
        {
            await email.EnviarAsync(mensagem, ct);
        }
        catch (FalhaEnvioEmail ex)
        {
            await tx.DesfazerAsync(CancellationToken.None);
            log.LogWarning(ex, "Falha ao enviar o e-mail de acesso do usuário interno {UsuarioId}", usuarioId);
            throw new ErroAplicacao(CodigoErro.EMAIL_ACESSO_FALHOU);
        }
        await tx.ConfirmarAsync(ct);
    }
}
