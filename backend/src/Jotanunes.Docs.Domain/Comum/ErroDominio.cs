namespace Jotanunes.Docs.Domain.Comum;

public enum TipoErroDominio
{
    /// <summary>Dados inválidos; <see cref="ErroDominio.Erros"/> traz as mensagens por campo.</summary>
    Validacao,
    /// <summary>Nova senha não atende à política.</summary>
    SenhaFraca,
    /// <summary>Transição de estado não permitida (ex.: envio já analisado).</summary>
    TransicaoInvalida,
    /// <summary>CNPJ não pode mudar depois do primeiro convite.</summary>
    CnpjImutavel,
}

/// <summary>Violação de regra de negócio. A camada de aplicação traduz para um código de erro estável.</summary>
public sealed class ErroDominio : Exception
{
    public ErroDominio(TipoErroDominio tipo, string mensagem, IReadOnlyDictionary<string, string[]>? erros = null)
        : base(mensagem)
    {
        Tipo = tipo;
        Erros = erros ?? new Dictionary<string, string[]>();
    }

    public TipoErroDominio Tipo { get; }

    public IReadOnlyDictionary<string, string[]> Erros { get; }

    public static ErroDominio Validacao(string campo, string mensagem) =>
        new(TipoErroDominio.Validacao, mensagem, new Dictionary<string, string[]> { [campo] = [mensagem] });
}

/// <summary>Acumula erros de validação por campo e lança um único <see cref="ErroDominio"/>.</summary>
public sealed class Validacao
{
    private readonly Dictionary<string, List<string>> _erros = new();

    public bool Valido => _erros.Count == 0;

    public void Erro(string campo, string mensagem)
    {
        if (!_erros.TryGetValue(campo, out var lista))
        {
            lista = [];
            _erros[campo] = lista;
        }
        lista.Add(mensagem);
    }

    public string? TextoObrigatorio(string campo, string? valor, int min, int max, string rotulo)
    {
        var v = valor?.Trim();
        if (string.IsNullOrEmpty(v))
        {
            Erro(campo, $"Informe {rotulo}.");
            return null;
        }
        if (v.Length < min || v.Length > max)
        {
            Erro(campo, $"{Capitalizar(rotulo)} deve ter entre {min} e {max} caracteres.");
            return null;
        }
        return v;
    }

    public string? TextoOpcional(string campo, string? valor, int max, string rotulo)
    {
        var v = valor?.Trim();
        if (string.IsNullOrEmpty(v)) return null;
        if (v.Length > max)
        {
            Erro(campo, $"{Capitalizar(rotulo)} deve ter no máximo {max} caracteres.");
            return null;
        }
        return v;
    }

    public void LancarSeHouver()
    {
        if (Valido) return;
        var erros = _erros.ToDictionary(kv => kv.Key, kv => kv.Value.ToArray());
        throw new ErroDominio(TipoErroDominio.Validacao, "Confira os dados informados.", erros);
    }

    private static string Capitalizar(string s) => s.Length == 0 ? s : char.ToUpperInvariant(s[0]) + s[1..];
}
