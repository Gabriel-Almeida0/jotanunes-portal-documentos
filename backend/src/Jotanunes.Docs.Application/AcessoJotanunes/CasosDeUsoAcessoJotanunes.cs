using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.UsuariosInternos;
using Microsoft.Extensions.Options;

namespace Jotanunes.Docs.Application.AcessoJotanunes;

/// <summary><c>GET /api/fluig/auth/configuracao</c>: o front decide entre a tela de login e "Abra este sistema pelo Fluig.".</summary>
public sealed class ObterConfiguracaoAcesso(IOptions<OpcoesLoginLocal> opcoes) : ICasoDeUso
{
    public ConfiguracaoAcessoDto Executar() => new(opcoes.Value.Habilitado);
}

/// <summary>
/// Login próprio da área Jotanunes (research R17), com a mesma ordem e regras do login do portal: validação →
/// usuário pelo login normalizado → (inexistente: bloqueado? 423 : BCrypt fictício + falha + 401) → bloqueado? 423 →
/// senha errada? falha (+ bloqueio na 5ª) + 401 → inativo? 403 → provisória vencida? 401 → sucesso. Nem a sequência
/// de respostas nem o tempo revelam se o login existe (FR-104).
/// </summary>
public sealed class LoginJotanunes(
    IUsuarioInternoRepositorio usuarios,
    ITentativasLoginRepositorio tentativas,
    IUnidadeTrabalho uow,
    IHasherSenha hasher,
    IEmissorTokenJotanunes emissor,
    IRegistroAuditoria auditoria,
    IOptions<OpcoesLoginLocal> opcoes,
    TimeProvider relogio) : ICasoDeUso
{
    public async Task<SessaoJotanunesDto> ExecutarAsync(LoginJotanunesInput entrada, CancellationToken ct = default)
    {
        if (!opcoes.Value.Habilitado) throw ErroAplicacao.NaoEncontrado();

        var erros = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(entrada.Login)) erros["login"] = ["Informe o login."];
        else if (entrada.Login.Length > LoginUsuario.TamanhoMaximo) erros["login"] = ["O login deve ter no máximo 100 caracteres."];
        if (string.IsNullOrEmpty(entrada.Senha)) erros["senha"] = ["Informe a senha."];
        else if (entrada.Senha.Length > 128) erros["senha"] = ["A senha deve ter no máximo 128 caracteres."];
        if (erros.Count > 0) throw new ErroAplicacao(CodigoErro.VALIDACAO, null, erros);

        var senha = entrada.Senha!;
        var login = LoginUsuario.Normalizar(entrada.Login);
        var formatoValido = LoginUsuario.EhValido(login);
        var agora = relogio.GetUtcNow();
        var usuario = formatoValido ? await usuarios.ObterPorLoginAsync(login, ct) : null;

        if (usuario is null) throw await RecusarSemUsuarioAsync(login, formatoValido, senha, agora, ct);

        var id = usuario.Id.ToString();
        if (usuario.EstaBloqueado(agora))
        {
            auditoria.Registrar(AtorAuditoria.Anonimo, usuario.Login, AcaoAuditoria.LoginBloqueado, RecursoAuditoria.UsuarioInterno, id);
            await uow.SalvarAsync(ct);
            throw new ErroAplicacao(CodigoErro.ACESSO_BLOQUEADO) { BloqueadoAte = usuario.BloqueadoAte };
        }

        if (!hasher.Verificar(senha, usuario.SenhaHash))
        {
            var bloqueou = usuario.RegistrarFalhaLogin(agora);
            auditoria.Registrar(AtorAuditoria.Anonimo, usuario.Login, AcaoAuditoria.LoginFalha, RecursoAuditoria.UsuarioInterno, id);
            if (bloqueou) auditoria.Registrar(AtorAuditoria.Anonimo, usuario.Login, AcaoAuditoria.LoginBloqueado, RecursoAuditoria.UsuarioInterno, id);
            await uow.SalvarAsync(ct);
            throw new ErroAplicacao(CodigoErro.LOGIN_INVALIDO);
        }

        // Senha certa, mas acesso recusado: a recusa também entra na trilha antes do erro.
        if (!usuario.Ativo) throw await RecusarComSenhaCertaAsync(usuario, new ErroAplicacao(CodigoErro.USUARIO_INATIVO, status: 403), ct);
        if (usuario.SenhaProvisoriaExpirada(agora)) throw await RecusarComSenhaCertaAsync(usuario, new ErroAplicacao(CodigoErro.SENHA_PROVISORIA_EXPIRADA), ct);

        usuario.RegistrarLoginSucesso(agora);
        auditoria.Registrar(AtorAuditoria.Local, usuario.Login, AcaoAuditoria.LoginSucesso, RecursoAuditoria.UsuarioInterno, id, atorAdmin: usuario.Admin);
        await uow.SalvarAsync(ct);
        return SessaoJotanunesDto.De(emissor.Emitir(usuario), usuario);
    }

    /// <summary>
    /// Login que não corresponde a usuário interno (inexistente ou fora do formato): mesmo contador e mesma regra
    /// (5 falhas → 423 por 15 min) e um BCrypt fictício. <c>ator_id</c> só recebe o login quando ele tem o formato de
    /// login — um texto qualquer pode ser uma senha digitada no campo errado.
    /// </summary>
    private async Task<ErroAplicacao> RecusarSemUsuarioAsync(string login, bool formatoValido, string senha, DateTimeOffset agora, CancellationToken ct)
    {
        var atorId = formatoValido ? login : null;
        var contador = await tentativas.ObterOuCriarPorLoginLocalAsync(login, ct);
        if (contador.EstaBloqueada(agora))
        {
            auditoria.Registrar(AtorAuditoria.Anonimo, atorId, AcaoAuditoria.LoginBloqueado);
            await uow.SalvarAsync(ct);
            return new ErroAplicacao(CodigoErro.ACESSO_BLOQUEADO) { BloqueadoAte = contador.BloqueadoAte };
        }

        hasher.VerificarFicticio(senha);
        var bloqueou = contador.RegistrarFalha(agora);
        auditoria.Registrar(AtorAuditoria.Anonimo, atorId, AcaoAuditoria.LoginFalha);
        if (bloqueou) auditoria.Registrar(AtorAuditoria.Anonimo, atorId, AcaoAuditoria.LoginBloqueado);
        await uow.SalvarAsync(ct);
        return new ErroAplicacao(CodigoErro.LOGIN_INVALIDO);
    }

    private async Task<ErroAplicacao> RecusarComSenhaCertaAsync(UsuarioInterno usuario, ErroAplicacao erro, CancellationToken ct)
    {
        auditoria.Registrar(AtorAuditoria.Anonimo, usuario.Login, AcaoAuditoria.LoginFalha, RecursoAuditoria.UsuarioInterno, usuario.Id.ToString());
        await uow.SalvarAsync(ct);
        return erro;
    }
}

/// <summary>
/// Troca de senha do usuário interno (obrigatória no primeiro acesso ou voluntária). Só para sessão de login próprio
/// (token do Fluig → 409 SO_LOGIN_LOCAL). Incrementa a versão da credencial e devolve um token novo.
/// </summary>
public sealed class TrocarSenhaJotanunes(
    IUsuarioFluigAtual atual,
    IUsuarioInternoRepositorio usuarios,
    IUnidadeTrabalho uow,
    IHasherSenha hasher,
    IEmissorTokenJotanunes emissor,
    IRegistroAuditoria auditoria,
    IOptions<OpcoesLoginLocal> opcoes,
    TimeProvider relogio) : ICasoDeUso
{
    public async Task<SessaoJotanunesDto> ExecutarAsync(TrocaSenhaInput entrada, CancellationToken ct = default)
    {
        if (!opcoes.Value.Habilitado) throw ErroAplicacao.NaoEncontrado();
        if (!atual.EhLoginLocal) throw new ErroAplicacao(CodigoErro.SO_LOGIN_LOCAL);

        var erros = new Dictionary<string, string[]>();
        if (string.IsNullOrEmpty(entrada.SenhaAtual)) erros["senhaAtual"] = ["Informe a senha atual."];
        if (string.IsNullOrEmpty(entrada.NovaSenha)) erros["novaSenha"] = ["Informe a nova senha."];
        if (erros.Count > 0) throw new ErroAplicacao(CodigoErro.VALIDACAO, null, erros);

        var usuario = await usuarios.ObterAsync(atual.UsuarioInternoId!.Value, ct) ?? throw new ErroAplicacao(CodigoErro.NAO_AUTENTICADO);
        if (!hasher.Verificar(entrada.SenhaAtual!, usuario.SenhaHash)) throw new ErroAplicacao(CodigoErro.SENHA_ATUAL_INCORRETA);
        try { usuario.TrocarSenha(entrada.NovaSenha, entrada.SenhaAtual, hasher.Gerar, relogio.GetUtcNow()); }
        catch (ErroDominio e) { throw ErroAplicacao.De(e); }

        auditoria.Registrar(AtorAuditoria.Local, usuario.Login, AcaoAuditoria.SenhaTrocada, RecursoAuditoria.UsuarioInterno, usuario.Id.ToString());
        await uow.SalvarAsync(ct);
        return SessaoJotanunesDto.De(emissor.Emitir(usuario), usuario);
    }
}

/// <summary>
/// Sair: incrementa a versão da credencial (o token cai na API na hora, inclusive em outras abas) e grava
/// SESSAO_ENCERRADA. Com token do Fluig não há o que revogar (204 sem efeito).
/// </summary>
public sealed class SairJotanunes(
    IUsuarioFluigAtual atual,
    IUsuarioInternoRepositorio usuarios,
    IUnidadeTrabalho uow,
    IRegistroAuditoria auditoria,
    IOptions<OpcoesLoginLocal> opcoes) : ICasoDeUso
{
    public async Task ExecutarAsync(CancellationToken ct = default)
    {
        if (!opcoes.Value.Habilitado) throw ErroAplicacao.NaoEncontrado();
        if (!atual.EhLoginLocal) return;

        var usuario = await usuarios.ObterAsync(atual.UsuarioInternoId!.Value, ct) ?? throw new ErroAplicacao(CodigoErro.NAO_AUTENTICADO);
        usuario.EncerrarSessoes();
        auditoria.Registrar(AtorAuditoria.Local, usuario.Login, AcaoAuditoria.SessaoEncerrada, RecursoAuditoria.UsuarioInterno, usuario.Id.ToString());
        await uow.SalvarAsync(ct);
    }
}
