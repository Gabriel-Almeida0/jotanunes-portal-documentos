using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.TiposDocumento;
using Microsoft.Extensions.Logging;

namespace Jotanunes.Docs.Application.TiposDocumento;

/// <summary>
/// Semeador idempotente do catálogo padrão (research R15, FR-090, FR-091, FR-093), chamado na inicialização da API.
/// Só cria quando <c>tipos_documento</c> não tem NENHUMA linha (ativa ou inativa); nunca altera nem reativa tipos.
/// Várias instâncias subindo juntas: o bloqueio exclusivo serializa a checagem e a inserção; se mesmo assim o índice
/// único de nome acusar duplicidade, outra instância já criou o catálogo e a inicialização segue normalmente.
/// </summary>
public sealed class SemearCatalogoTiposPadrao(ITipoDocumentoRepositorio tipos, IUnidadeTrabalho uow, IBloqueioExclusivo bloqueio,
    TimeProvider relogio, ILogger<SemearCatalogoTiposPadrao> log) : ICasoDeUso
{
    /// <summary>Chave do bloqueio exclusivo (constante do sistema; "JNTIPOS" em ASCII).</summary>
    public const long ChaveBloqueio = 0x4A4E5449504F53;

    /// <returns>Quantidade de tipos criados (10 ou 0).</returns>
    public async Task<int> ExecutarAsync(CancellationToken ct = default)
    {
        await using var transacao = await uow.IniciarTransacaoAsync(ct);
        await bloqueio.AdquirirAsync(ChaveBloqueio, ct);
        if (await tipos.ExisteAlgumAsync(ct))
        {
            log.LogDebug("Catálogo de tipos de documento já tem tipos; nada a semear.");
            return 0;
        }

        var agora = relogio.GetUtcNow();
        foreach (var item in CatalogoTiposPadrao.Itens)
        {
            tipos.Adicionar(TipoDocumento.Criar(item.Nome, item.Instrucoes, CatalogoTiposPadrao.Autor, agora));
        }
        try
        {
            await uow.SalvarAsync(ct);
        }
        catch (ErroAplicacao e) when (e.Codigo == CodigoErro.NOME_DUPLICADO)
        {
            log.LogInformation("Catálogo padrão de tipos de documento já criado por outra instância.");
            return 0;
        }
        await transacao.ConfirmarAsync(ct);
        log.LogInformation("Catálogo padrão criado com {Quantidade} tipos de documento.", CatalogoTiposPadrao.Itens.Count);
        return CatalogoTiposPadrao.Itens.Count;
    }
}
