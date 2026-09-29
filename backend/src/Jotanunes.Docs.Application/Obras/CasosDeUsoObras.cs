using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Obras;

namespace Jotanunes.Docs.Application.Obras;

public sealed class CriarObra(IObraRepositorio obras, IUnidadeTrabalho uow, IUsuarioFluigAtual usuario, TimeProvider relogio) : ICasoDeUso
{
    public async Task<ObraDto> ExecutarAsync(ObraInput entrada, CancellationToken ct = default)
    {
        Obra obra;
        try { obra = Obra.Criar(entrada.Nome, entrada.Codigo, entrada.Cidade, entrada.Uf, usuario.Login, relogio.GetUtcNow()); }
        catch (ErroDominio e) { throw ErroAplicacao.De(e); }
        obras.Adicionar(obra);
        await uow.SalvarAsync(ct);
        return ObraDto.De(obra);
    }
}

public sealed class AtualizarObra(IObraRepositorio obras, IUnidadeTrabalho uow, IUsuarioFluigAtual usuario, TimeProvider relogio) : ICasoDeUso
{
    public async Task<ObraDto> ExecutarAsync(Guid id, ObraInput entrada, CancellationToken ct = default)
    {
        var obra = await obras.ObterAsync(id, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var ativa = Entrada.Obrigatorio(entrada.Ativa, "ativa");
        try { obra.Atualizar(entrada.Nome, entrada.Codigo, entrada.Cidade, entrada.Uf, ativa, usuario.Login, relogio.GetUtcNow()); }
        catch (ErroDominio e) { throw ErroAplicacao.De(e); }
        await uow.SalvarAsync(ct);
        return ObraDto.De(obra);
    }
}

public sealed class ListarObras(IObraRepositorio obras) : ICasoDeUso
{
    public Task<PaginaResultado<ObraResumoDto>> ExecutarAsync(string? busca, bool? ativa, int? pagina, int? tamanhoPagina, CancellationToken ct = default) =>
        obras.ListarAsync(Entrada.Busca(busca), ativa, Paginacao.Criar(pagina, tamanhoPagina), ct);
}

public sealed class ObterObra(IObraRepositorio obras, IConsultaDocumentos consulta, TimeProvider relogio) : ICasoDeUso
{
    public async Task<ObraDetalheDto> ExecutarAsync(Guid id, CancellationToken ct = default)
    {
        var obra = await obras.ObterAsync(id, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var vinculadas = await obras.ListarEmpresasDaObraAsync(id, ct);
        var contagens = await consulta.ContarPorEmpresaAsync(vinculadas.Select(v => v.Empresa.Id).ToList(), ct);
        var agora = relogio.GetUtcNow();
        var empresas = vinculadas
            .Select(v => new EmpresaNaObraDto(v.Empresa.Id, v.Empresa.RazaoSocial, v.Empresa.Cnpj, v.Empresa.ObterSituacaoAcesso(agora),
                v.VinculadoEm, contagens[v.Empresa.Id]))
            .ToList();
        return new ObraDetalheDto(obra.Id, obra.Nome, obra.Codigo, obra.Cidade, obra.Uf, obra.Ativa, obra.CriadoEm, empresas);
    }
}

public sealed class VincularEmpresa(IObraRepositorio obras, IEmpresaRepositorio empresas, IUsuarioFluigAtual usuario, TimeProvider relogio) : ICasoDeUso
{
    public async Task ExecutarAsync(Guid obraId, Guid empresaId, CancellationToken ct = default)
    {
        _ = await obras.ObterAsync(obraId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        _ = await empresas.ObterAsync(empresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        await obras.VincularAsync(new ObraEmpresa(obraId, empresaId, usuario.Login, relogio.GetUtcNow()), ct);
    }
}

public sealed class DesvincularEmpresa(IObraRepositorio obras, IUnidadeTrabalho uow) : ICasoDeUso
{
    public async Task ExecutarAsync(Guid obraId, Guid empresaId, CancellationToken ct = default)
    {
        var vinculo = await obras.ObterVinculoAsync(obraId, empresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        obras.RemoverVinculo(vinculo);
        await uow.SalvarAsync(ct);
    }
}
