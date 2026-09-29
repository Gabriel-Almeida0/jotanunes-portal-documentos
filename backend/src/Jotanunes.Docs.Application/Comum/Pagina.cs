using Jotanunes.Docs.Application.Erros;

namespace Jotanunes.Docs.Application.Comum;

public sealed record PaginaResultado<T>(IReadOnlyList<T> Itens, int Total, int Pagina, int TamanhoPagina);

/// <summary>Parâmetros de paginação validados: pagina ≥ 1; tamanhoPagina 1–100 (padrão 20).</summary>
public sealed record Paginacao(int Pagina, int TamanhoPagina)
{
    public const int TamanhoPadrao = 20;
    public const int TamanhoMaximo = 100;

    public int Pular => (Pagina - 1) * TamanhoPagina;

    public static Paginacao Criar(int? pagina, int? tamanhoPagina)
    {
        var erros = new Dictionary<string, string[]>();
        var p = pagina ?? 1;
        var t = tamanhoPagina ?? TamanhoPadrao;
        if (p < 1) erros["pagina"] = ["A página deve ser maior ou igual a 1."];
        if (t is < 1 or > TamanhoMaximo) erros["tamanhoPagina"] = ["O tamanho da página deve ser de 1 a 100."];
        if (erros.Count > 0) throw new ErroAplicacao(CodigoErro.VALIDACAO, null, erros);
        return new Paginacao(p, t);
    }
}
