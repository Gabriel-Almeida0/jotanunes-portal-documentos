using Jotanunes.Docs.Domain.Comum;

namespace Jotanunes.Docs.Application.Erros;

/// <summary>Erro de negócio com código estável; a API converte em application/problem+json.</summary>
public sealed class ErroAplicacao : Exception
{
    public ErroAplicacao(CodigoErro codigo, string? detalhe = null,
        IReadOnlyDictionary<string, string[]>? errosPorCampo = null, int? status = null)
        : base(detalhe ?? CatalogoErros.Obter(codigo).Titulo)
    {
        Codigo = codigo;
        Detalhe = detalhe;
        ErrosPorCampo = errosPorCampo;
        Status = status ?? CatalogoErros.Obter(codigo).Status;
    }

    public CodigoErro Codigo { get; }
    public string? Detalhe { get; }
    public IReadOnlyDictionary<string, string[]>? ErrosPorCampo { get; }
    public int Status { get; }

    /// <summary>Somente em ACESSO_BLOQUEADO.</summary>
    public DateTimeOffset? BloqueadoAte { get; init; }

    public static ErroAplicacao NaoEncontrado() => new(CodigoErro.NAO_ENCONTRADO);

    public static ErroAplicacao Validacao(string campo, string mensagem) =>
        new(CodigoErro.VALIDACAO, null, new Dictionary<string, string[]> { [campo] = [mensagem] });

    /// <summary>Traduz uma violação de regra do domínio para o código do contrato.</summary>
    public static ErroAplicacao De(ErroDominio erro) => erro.Tipo switch
    {
        TipoErroDominio.Validacao => new(CodigoErro.VALIDACAO, null, erro.Erros),
        TipoErroDominio.SenhaFraca => new(CodigoErro.SENHA_FRACA, erro.Message),
        TipoErroDominio.TransicaoInvalida => new(CodigoErro.ENVIO_JA_ANALISADO),
        TipoErroDominio.CnpjImutavel => new(CodigoErro.CNPJ_IMUTAVEL),
        _ => new(CodigoErro.ERRO_INTERNO),
    };
}
