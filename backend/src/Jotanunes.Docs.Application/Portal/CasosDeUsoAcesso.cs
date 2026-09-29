using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Convites;
using Jotanunes.Docs.Domain.Empresas;

namespace Jotanunes.Docs.Application.Portal;

public sealed class ValidarConvite(IConviteRepositorio convites, IEmpresaRepositorio empresas, IGeradorSegredos segredos, TimeProvider relogio) : ICasoDeUso
{
    public async Task<ConviteValidacaoDto> ExecutarAsync(string? token, CancellationToken ct = default)
    {
        var invalido = new ErroAplicacao(CodigoErro.CONVITE_INVALIDO);
        if (string.IsNullOrWhiteSpace(token) || token.Length is < 20 or > 100) throw invalido;
        var convite = await convites.ObterPorTokenHashAsync(segredos.CalcularHashToken(token), ct) ?? throw invalido;
        if (convite.Situacao(relogio.GetUtcNow()) != SituacaoConvite.VALIDO) throw invalido;
        var empresa = await empresas.ObterAsync(convite.EmpresaId, ct);
        if (empresa is null || !empresa.Ativa) throw invalido;
        return new ConviteValidacaoDto(empresa.Cnpj, empresa.RazaoSocial, convite.ExpiraEm);
    }
}

public sealed class LoginPortal(
    IEmpresaRepositorio empresas,
    IUnidadeTrabalho uow,
    IHasherSenha hasher,
    IEmissorTokenPortal emissor,
    IRegistroAuditoria auditoria,
    TimeProvider relogio) : ICasoDeUso
{
    public async Task<SessaoPortalDto> ExecutarAsync(LoginInput entrada, CancellationToken ct = default)
    {
        var erros = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(entrada.Cnpj)) erros["cnpj"] = ["Informe o CNPJ."];
        if (string.IsNullOrEmpty(entrada.Senha)) erros["senha"] = ["Informe a senha."];
        else if (entrada.Senha.Length > 128) erros["senha"] = ["A senha deve ter no máximo 128 caracteres."];
        if (erros.Count > 0) throw new ErroAplicacao(CodigoErro.VALIDACAO, null, erros);

        var senha = entrada.Senha!;
        var cnpj = Cnpj.Normalizar(entrada.Cnpj);
        var agora = relogio.GetUtcNow();
        var empresa = Cnpj.EhValido(cnpj) ? await empresas.ObterPorCnpjAsync(cnpj, ct) : null;

        if (empresa?.SenhaHash is null)
        {
            hasher.VerificarFicticio(senha);
            auditoria.Registrar(AtorAuditoria.Anonimo, Limitar(cnpj), AcaoAuditoria.LoginFalha);
            await uow.SalvarAsync(ct);
            throw new ErroAplicacao(CodigoErro.CREDENCIAIS_INVALIDAS);
        }

        if (empresa.EstaBloqueada(agora))
        {
            auditoria.Registrar(AtorAuditoria.Anonimo, empresa.Cnpj, AcaoAuditoria.LoginBloqueado, "EMPRESA", empresa.Id.ToString());
            await uow.SalvarAsync(ct);
            throw new ErroAplicacao(CodigoErro.ACESSO_BLOQUEADO) { BloqueadoAte = empresa.BloqueadoAte };
        }

        if (!hasher.Verificar(senha, empresa.SenhaHash))
        {
            var bloqueou = empresa.RegistrarFalhaLogin(agora);
            auditoria.Registrar(AtorAuditoria.Anonimo, empresa.Cnpj, AcaoAuditoria.LoginFalha, "EMPRESA", empresa.Id.ToString());
            if (bloqueou) auditoria.Registrar(AtorAuditoria.Anonimo, empresa.Cnpj, AcaoAuditoria.LoginBloqueado, "EMPRESA", empresa.Id.ToString());
            await uow.SalvarAsync(ct);
            throw new ErroAplicacao(CodigoErro.CREDENCIAIS_INVALIDAS);
        }

        if (!empresa.Ativa) throw new ErroAplicacao(CodigoErro.EMPRESA_INATIVA, status: 403);
        if (empresa.SenhaTemporariaExpirada(agora)) throw new ErroAplicacao(CodigoErro.CONVITE_EXPIRADO);

        empresa.RegistrarLoginSucesso(agora);
        auditoria.Registrar(AtorAuditoria.Empresa, empresa.Id.ToString(), AcaoAuditoria.LoginSucesso, "EMPRESA", empresa.Id.ToString());
        await uow.SalvarAsync(ct);
        var token = emissor.Emitir(empresa);
        return new SessaoPortalDto(token.AccessToken, token.ExpiraEm, EmpresaPortalDto.De(empresa));
    }

    private static string Limitar(string cnpj) => cnpj.Length > 100 ? cnpj[..100] : cnpj;
}

public sealed class TrocarSenha(
    IEmpresaPortalAtual atual,
    IEmpresaRepositorio empresas,
    IConviteRepositorio convites,
    IUnidadeTrabalho uow,
    IHasherSenha hasher,
    IEmissorTokenPortal emissor,
    IRegistroAuditoria auditoria,
    TimeProvider relogio) : ICasoDeUso
{
    public async Task<SessaoPortalDto> ExecutarAsync(TrocaSenhaInput entrada, CancellationToken ct = default)
    {
        var erros = new Dictionary<string, string[]>();
        if (string.IsNullOrEmpty(entrada.SenhaAtual)) erros["senhaAtual"] = ["Informe a senha atual."];
        if (string.IsNullOrEmpty(entrada.NovaSenha)) erros["novaSenha"] = ["Informe a nova senha."];
        if (erros.Count > 0) throw new ErroAplicacao(CodigoErro.VALIDACAO, null, erros);

        var empresa = await empresas.ObterAsync(atual.EmpresaId, ct) ?? throw new ErroAplicacao(CodigoErro.NAO_AUTENTICADO);
        if (empresa.SenhaHash is null || !hasher.Verificar(entrada.SenhaAtual!, empresa.SenhaHash))
        {
            throw new ErroAplicacao(CodigoErro.SENHA_ATUAL_INCORRETA);
        }
        try { PoliticaSenha.Validar(entrada.NovaSenha, entrada.SenhaAtual); }
        catch (ErroDominio e) { throw ErroAplicacao.De(e); }

        var agora = relogio.GetUtcNow();
        if (empresa.TrocaSenhaObrigatoria)
        {
            foreach (var c in await convites.ListarAbertosAsync(empresa.Id, ct)) c.MarcarUsado(agora);
        }
        empresa.TrocarSenha(hasher.Gerar(entrada.NovaSenha!), agora);
        auditoria.Registrar(AtorAuditoria.Empresa, empresa.Id.ToString(), AcaoAuditoria.SenhaTrocada, "EMPRESA", empresa.Id.ToString());
        await uow.SalvarAsync(ct);
        var token = emissor.Emitir(empresa);
        return new SessaoPortalDto(token.AccessToken, token.ExpiraEm, EmpresaPortalDto.De(empresa));
    }
}

public sealed class ObterEmpresaPortal(IEmpresaPortalAtual atual, IEmpresaRepositorio empresas) : ICasoDeUso
{
    public async Task<EmpresaPortalDto> ExecutarAsync(CancellationToken ct = default) =>
        EmpresaPortalDto.De(await empresas.ObterAsync(atual.EmpresaId, ct) ?? throw new ErroAplicacao(CodigoErro.NAO_AUTENTICADO));
}
