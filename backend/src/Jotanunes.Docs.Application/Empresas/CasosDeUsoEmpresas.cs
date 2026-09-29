using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Empresas;

namespace Jotanunes.Docs.Application.Empresas;

public sealed class MontadorEmpresa(IObraRepositorio obras, IConviteRepositorio convites, IConsultaDocumentos consulta, TimeProvider relogio) : ICasoDeUso
{
    public async Task<EmpresaDto> MontarAsync(Empresa e, CancellationToken ct = default)
    {
        var agora = relogio.GetUtcNow();
        var obrasDaEmpresa = await obras.ListarObrasDaEmpresaAsync(e.Id, ct);
        var ultimo = await convites.ObterUltimoAsync(e.Id, ct);
        var contagem = (await consulta.ContarPorEmpresaAsync([e.Id], ct))[e.Id];
        return new EmpresaDto(e.Id, e.RazaoSocial, e.NomeFantasia, e.Cnpj, e.EmailContato, e.Ativa, e.ObterSituacaoAcesso(agora), contagem,
            e.NomeContato, e.Telefone, obrasDaEmpresa.Select(ObraRefDto.De).ToList(), CnpjEditavel: ultimo is null && !e.JaConvidada,
            ultimo is null ? null : ConviteDto.De(ultimo, agora), e.UltimoAcessoEm, e.CriadoEm);
    }
}

public sealed class CriarEmpresa(IEmpresaRepositorio empresas, IUnidadeTrabalho uow, IUsuarioFluigAtual usuario, TimeProvider relogio,
    MontadorEmpresa montador) : ICasoDeUso
{
    public async Task<EmpresaDto> ExecutarAsync(EmpresaInput i, CancellationToken ct = default)
    {
        Empresa e;
        try { e = Empresa.Criar(i.RazaoSocial, i.NomeFantasia, i.Cnpj, i.EmailContato, i.NomeContato, i.Telefone, usuario.Login, relogio.GetUtcNow()); }
        catch (ErroDominio erro) { throw ErroAplicacao.De(erro); }
        empresas.Adicionar(e);
        await uow.SalvarAsync(ct);
        return await montador.MontarAsync(e, ct);
    }
}

public sealed class AtualizarEmpresa(IEmpresaRepositorio empresas, IConviteRepositorio convites, IUnidadeTrabalho uow, IUsuarioFluigAtual usuario,
    TimeProvider relogio, MontadorEmpresa montador) : ICasoDeUso
{
    public async Task<EmpresaDto> ExecutarAsync(Guid id, EmpresaInput i, CancellationToken ct = default)
    {
        var e = await empresas.ObterAsync(id, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var ativa = Entrada.Obrigatorio(i.Ativa, "ativa");
        var jaConvidada = e.JaConvidada || await convites.ObterUltimoAsync(id, ct) is not null;
        try { e.Atualizar(i.RazaoSocial, i.NomeFantasia, i.Cnpj, i.EmailContato, i.NomeContato, i.Telefone, ativa, jaConvidada, usuario.Login, relogio.GetUtcNow()); }
        catch (ErroDominio erro) { throw ErroAplicacao.De(erro); }
        await uow.SalvarAsync(ct);
        return await montador.MontarAsync(e, ct);
    }
}

public sealed class ListarEmpresas(IEmpresaRepositorio empresas, IConsultaDocumentos consulta, TimeProvider relogio) : ICasoDeUso
{
    public async Task<PaginaResultado<EmpresaResumoDto>> ExecutarAsync(string? busca, Guid? obraId, string? situacaoAcesso, bool? comPendencia,
        int? pagina, int? tamanhoPagina, CancellationToken ct = default)
    {
        var agora = relogio.GetUtcNow();
        var filtro = new FiltroEmpresas(Entrada.Busca(busca), obraId, Entrada.EnumOpcional<SituacaoAcesso>(situacaoAcesso, "situacaoAcesso"),
            comPendencia, agora);
        var pag = await empresas.ListarAsync(filtro, Paginacao.Criar(pagina, tamanhoPagina), ct);
        var contagens = await consulta.ContarPorEmpresaAsync(pag.Itens.Select(e => e.Id).ToList(), ct);
        var itens = pag.Itens.Select(e => new EmpresaResumoDto(e.Id, e.RazaoSocial, e.NomeFantasia, e.Cnpj, e.EmailContato, e.Ativa,
            e.ObterSituacaoAcesso(agora), contagens[e.Id])).ToList();
        return new PaginaResultado<EmpresaResumoDto>(itens, pag.Total, pag.Pagina, pag.TamanhoPagina);
    }
}

public sealed class ObterEmpresa(IEmpresaRepositorio empresas, MontadorEmpresa montador) : ICasoDeUso
{
    public async Task<EmpresaDto> ExecutarAsync(Guid id, CancellationToken ct = default)
    {
        var e = await empresas.ObterAsync(id, ct) ?? throw ErroAplicacao.NaoEncontrado();
        return await montador.MontarAsync(e, ct);
    }
}
